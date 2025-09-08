import { Request, Response } from "express";
import { Client, LocalAuth, MessageMedia } from "whatsapp-web.js";
import qrcode from "qrcode";
import { clients, status, messages, logsClient } from "../state";
import axios, { AxiosResponse } from "axios";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import logger from "../utils/logger";
import TimeService from "../services/TimeService";
import { SafeLocalAuth } from "../services/SafeLocalAuth";

dotenv.config();
const webhook = process.env.WEBHOOK_URL || "http://127.0.0.1:8000/";
const apiCall = false;
// Type definitions
type DeviceState =
  | "ready"
  | "failed"
  | "disconnected"
  | "initializing"
  | "reconnected";

interface Device {
  id: string;
  status: DeviceState;
  lastReconnected?: string;
}
interface Message {
  body: string;
}
interface WebhookData {
  deviceId: string;
  messageBody: any;
  timestamp: string;
}

interface WebhookDataStatus {
  deviceId: string;
  status: string;
  timestamp: string;
}
interface StatusMap {
  [deviceId: string]: DeviceState;
}

interface MessageMap {
  [deviceId: string]: any[]; // Replace 'any' with specific message type if available
}

interface ClientMap {
  [deviceId: string]: Client;
}

// Create device (initialize WhatsApp Web client)
const createDevice = async (req: Request, res: Response): Promise<void> => {
  const { deviceId } = req.body;
  if (!logsClient[deviceId]) {
    logsClient[deviceId];
  }
  if (!deviceId) {
    res.status(200).json({ status: 401, msg: "Device ID is required." });
    return;
  }

  if (clients[deviceId]) {
    try {
      const clientPup = clients[deviceId];
      if (clientPup.pupBrowser?.isConnected()) {
        await clientPup.pupBrowser.close();
        logger.info(`Closed Puppeteer browser for device ${deviceId}`);
      }
      await clients[deviceId].logout();
      await clients[deviceId].destroy();
      //   await new Promise((res) => setTimeout(res, 1000));
    } catch (err: any) {
      console.warn(`Client cleanup failed for ${deviceId}:`, err.message);
    }
  } 

  try {
    // Increase the maximum number of listeners to avoid the warning
    process.setMaxListeners(200); // Adjust this number based on your needs
    const client = new Client({
      authStrategy: new SafeLocalAuth({ clientId: deviceId }),
      puppeteer: {
        headless: true,
        // timeout: 60000,
        args: [
          "--disable-logging",
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-gpu",
          "--disable-dev-shm-usage",
          //   "--single-process",
          //   "--disable-dev-shm-usage",
        ],
      },
    });
    let responseSent = false;
    client.on("qr", async (qr: string) => {
      if (responseSent) return;
      console.log("qr serve");
      const qrCodeImage = await qrcode.toDataURL(qr);
      const qrImage = `<img src="${qrCodeImage}" alt="QR Code" />`;

      if (logsClient[deviceId]) {
        logsClient[deviceId].status = "QR";
        logsClient[deviceId].timestamp = TimeService.nowISO();
      }

      if (!res.headersSent) {
        callWebStatus(deviceId, "INITIALIZING");
        return res
          .status(200)
          .json({ status: 201, qr: qrCodeImage, deviceId, qrImage });
      }
      responseSent = true;
    });

    client.on("ready", async () => {
      status[deviceId] = "ready";
      //   const userInfo = await client.getContactById(client.info.wid._serialized);
      const phoneNumber = client.info.wid.user; // Extracts the phone number
      console.log(`Device ${deviceId} is ready.`);

      if (logsClient[deviceId]) {
        logsClient[deviceId].status = "READY";
        logsClient[deviceId].timestamp = TimeService.nowISO();
      }

      callWebStatus(deviceId, "READY", phoneNumber);
      if (responseSent) return;
      if (!res.headersSent) {
        return res
          .status(200)
          .json({ status: 200, message: "Device reconnected successfully." });
      }
    });

    client.on("auth_failure", async () => {
      console.log(`Device ${deviceId} authentication failed.`);
      status[deviceId] = "failed";
      //   await fileDelete(deviceId);
      if (logsClient[deviceId]) {
        logsClient[deviceId].status = "FAILED";
        logsClient[deviceId].timestamp = TimeService.nowISO();
      }
      callWebStatus(deviceId, "FAILED");
      try {
        if (client.pupBrowser?.isConnected()) {
          await client.pupBrowser.close();
          logger.info(`Closed Puppeteer browser for device ${deviceId}`);
        } else {
          logger.warn(
            `Puppeteer browser already closed for device ${deviceId}`
          );
        }
        await client.logout(); // Triggers SafeLocalAuth.logout
        await client.destroy();
        logger.info(
          `Successfully disconnected and cleaned up device ${deviceId}`
        );
      } catch (err: any) {
        if (
          err.message.includes("Protocol error") &&
          err.message.includes("Session closed")
        ) {
          logger.warn(
            `Puppeteer session already closed for ${deviceId}: ${err.message}`
          );
        } else {
          logger.error(
            `Error during disconnect cleanup for ${deviceId}: ${err.message}`
          );
        }
      }
      if (responseSent) return;
      if (!res.headersSent) {
        return res
          .status(500)
          .json({ status: 500, msg: "Device authentication failed." });
      }
    });

    client.on("disconnected", async () => {
      if (logsClient[deviceId]) {
        logsClient[deviceId].status = "DISCONNECTED";
        logsClient[deviceId].timestamp = TimeService.nowISO();
      }
      console.log(`Device ${deviceId} is disconnected.`);
      const phoneNumber = client.info?.wid?.user || "unknown";
      status[deviceId] = "disconnected";
      //   fileDelete(deviceId);
      callWebStatus(deviceId, "DISCONNECTED", phoneNumber);

      try {
        if (client.pupBrowser?.isConnected()) {
          await client.pupBrowser.close();
          logger.info(`Closed Puppeteer browser for device ${deviceId}`);
        } else {
          logger.warn(
            `Puppeteer browser already closed for device ${deviceId}`
          );
        }
        await client.logout(); // Triggers SafeLocalAuth.logout
        await client.destroy();
        logger.info(
          `Successfully disconnected and cleaned up device ${deviceId}`
        );
      } catch (err: any) {
        if (
          err.message.includes("Protocol error") &&
          err.message.includes("Session closed")
        ) {
          logger.warn(
            `Puppeteer session already closed for ${deviceId}: ${err.message}`
          );
        } else {
          logger.error(
            `Error during disconnect cleanup for ${deviceId}: ${err.message}`
          );
        }
      }
      if (responseSent) return;
      if (!res.headersSent) {
        return res
          .status(200)
          .json({ status: 203, message: "Device disconnected." });
      }
      responseSent = true;
    });

    client.on("message", async (message) => {
      console.log(
        `Message received on device ${deviceId}: ${JSON.stringify(message)}`
      );
      if (!messages[deviceId]) {
        messages[deviceId] = [];
      }

      messages[deviceId].push(message);
      callWebhook(deviceId, message);
      if (responseSent) return;
      if (!res.headersSent) {
        return res.status(200).json({
          status: 204,
          message: "Message received successfully.",
          messages,
        });
      }
      responseSent = true;
    });

    clients[deviceId] = client;
    status[deviceId] = "initializing";
    callWebStatus(deviceId, "INITIALIZING");
    process.once("SIGINT", async () => {
      console.log("Received SIGINT. Exiting...");
      try {
        //   await client.logout();
        // await client.destroy();
        // await new Promise((res) => setTimeout(res, 1000));
      } catch (err: any) {
        console.warn("Cleanup error:", err.message);
      }
    });

    process.once("exit", async () => {
      console.log("Process exiting...");
      //   await client.logout();
      //   await client.destroy();
      //   await new Promise((res) => setTimeout(res, 1000));
      //   await fileDelete(deviceId);
      // Any final cleanup logic can go here
    });
    await client.initialize();
    if (!res.headersSent) {
      res.status(200).json({
        status: 204,
        msg: "Device initialization started successfully.",
        deviceId,
      });
      if (responseSent) return;
    }
  } catch (error) {
    if (status[deviceId]) {
      delete status[deviceId];
    }
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error occurred";
    console.error(`Error creating device ${deviceId}:`, errorMessage);
    if (!res.headersSent) {
      res.status(500).json({ status: 500, msg: "Failed to create device." });
    }
  }
};

const fileDelete = async (deviceId: string): Promise<void> => {
  const folderPath = path.join(
    path.resolve(__dirname, "..", ".."),
    ".wwebjs_auth",
    `session-${deviceId}`
  );
  try {
    if (fs.existsSync(folderPath)) {
      var d: any = TimeService.getTime();
      const newFolderName = folderPath + "_remove" + d; // The new name you want to assign to the folder
      //   await fs.promises.rename(folderPath, newFolderName);
      // const newFolderPath = path.join(path.dirname(folderPath), newFolderName);
      if (fs.existsSync(newFolderName)) {
        // deleteFolderRecursive(newFolderName);
        // await deleteFolderRecursive(newFolderName);
      }
    }
  } catch (error) {
    console.error("Error deleting session folder:", error);
  }
};

const deleteFolderRecursive = async (folderPath: string): Promise<void> => {
  try {
    // Check if the folder exists
    if (fs.existsSync(folderPath)) {
      // Get all files and directories in the folder
      fs.chmodSync(folderPath, 0o666);
      // fs.unlinkSync(folderPath);
      await fs.rmSync(folderPath, { recursive: true, force: true });
      // const files = fs.readdirSync(folderPath);
      // files.forEach(file => {
      //     const currentPath = path.join(folderPath, file);
      //     const stat = fs.statSync(currentPath);

      //     // If it's a directory, recursively call deleteFolderRecursive
      //     if (stat.isDirectory()) {
      //         deleteFolderRecursive(currentPath);
      //     } else {
      //         // If it's a file, delete it
      //         fs.unlinkSync(currentPath);
      //     }
      // });
      // Now delete the empty folder
      // fs.rmdirSync(folderPath,{ recursive: true });
      console.log(`Folder deleted: ${folderPath}`);
    } else {
      console.log(`Folder not found: ${folderPath}`);
    }
  } catch (error) {
    console.error("Error while deleting folder:", error);
  }
};

// Function to send data to a webhook
const callWebStatus = async (
  deviceId: string,
  status: string,
  phoneNumber?: string
): Promise<void> => {
  const webhookData: WebhookDataStatus = {
    deviceId: deviceId,
    status: status,
    timestamp: TimeService.nowISO(),
  };

  if (status === "DISCONNECTED" || status === "READY") {
    // const userInfo = await client.getContactById(client.info.wid._serialized);
    logger.info(`Device ${status}: ${deviceId}`, {
      deviceId,
      time: TimeService.nowISO(),
      status,
      phoneNumber,
    });
  } else {
  }

  if(!apiCall) return;

  const webhookUrl = `${webhook}receiveWhatsappNodeStatus`;

  try {
    const response: AxiosResponse = await axios.post(webhookUrl, webhookData);
    console.log("Webhook response status:", response.data);
    console.log("Webhook response webhookData:", webhookData);
  } catch (error) {
    console.error("Error calling webhook status:", error);
  }
};

// Function to send data to a webhook
const callWebhook = async (
  deviceId: string,
  message: Message
): Promise<void> => {
  const webhookData: WebhookData = {
    deviceId: deviceId,
    messageBody: message,
    timestamp: TimeService.nowISO(),
  };
  if(!apiCall) return;
  const webhookUrl = `${webhook}receiveWhatsappNode`; // Replace with your actual webhook URL

  try {
    const response: AxiosResponse = await axios.post(webhookUrl, webhookData);
    console.log("Webhook response:", response.data);
  } catch (error) {
    console.error("Error calling webhook:", error);
  }
};

// Check the status of a device
const checkDeviceStatus = async (
  req: Request,
  res: Response
): Promise<void> => {
  const { deviceId } = req.body;
  if (!deviceId) {
    res.status(200).json({ status: 401, msg: "Device ID is required." });
    return;
  }

  try {
    if (!status[deviceId]) {
      res
        .status(200)
        .json({ status: 322, msg: `Device with ID '${deviceId}' not found.` });
      return;
    }
    // const block = clients[deviceId].getBlockedContacts();
    res
      .status(200)
      .json({ status: 200, deviceId, device_status: status[deviceId] });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error occurred";
    console.error(
      `Error checking status for device ${deviceId}:`,
      errorMessage
    );
    res
      .status(500)
      .json({ status: 500, msg: "Failed to check device status." });
  }
};

const executeWhatsAppMethod = async (
  req: Request,
  res: Response
): Promise<void> => {
    res.status(400).json({ status: 400, msg: "Missing deviceId or methodName" });
    return
  const { deviceId, methodName, argsName } = req.body;

  if (!deviceId || !methodName) {
    res.status(400).json({ status: 400, msg: "Missing deviceId or methodName" });

    return;
  }

  const client = clients[deviceId];

  if (!client) {
    res.status(404).json({ status: 404, msg: "Client not found" });
    return;
  }

  // Allowed methods map
  const methodMap: Record<string, string> = {
    // Basic user/contact info
    isRegisteredUser: "isRegisteredUser",
    checkRegistered: "isRegisteredUser", // alias
    getNumberId: "getNumberId",
    getUserNumberId: "getNumberId", // alias

    // Chat operations
    muteChat: "muteChat",
    unmuteChat: "unmuteChat",
    archiveChat: "archiveChat",
    unarchiveChat: "unarchiveChat",
    pinChat: "pinChat",
    unpinChat: "unpinChat",
    markChatUnread: "markChatUnread",
    getChatById: "getChatById",
    getChats: "getChats",
    getChatLabels: "getChatLabels",
    addOrRemoveLabels: "addOrRemoveLabels",
    getChatsByLabelId: "getChatsByLabelId",

    // Contact operations
    getContactById: "getContactById",
    getContacts: "getContacts",
    getBlockedContacts: "getBlockedContacts",
    getContactDeviceCount: "getContactDeviceCount",
    getProfilePicUrl: "getProfilePicUrl",
    getCommonGroups: "getCommonGroups",

    // Group operations
    acceptInvite: "acceptInvite",
    acceptGroupV4Invite: "acceptGroupV4Invite",
    getInviteInfo: "getInviteInfo",
    createGroup: "createGroup",
    getGroupMembershipRequests: "getGroupMembershipRequests",
    approveGroupMembershipRequests: "approveGroupMembershipRequests",
    rejectGroupMembershipRequests: "rejectGroupMembershipRequests",

    // Messaging
    sendMessage: "sendMessage",
    getMessageById: "getMessageById",
    searchMessages: "searchMessages",
    sendPresenceAvailable: "sendPresenceAvailable",
    sendPresenceUnavailable: "sendPresenceUnavailable",
    sendSeen: "sendSeen",

    // User profile/status
    setStatus: "setStatus",
    setDisplayName: "setDisplayName",
    setProfilePicture: "setProfilePicture",
    deleteProfilePicture: "deleteProfilePicture",

    // Settings
    setAutoDownloadAudio: "setAutoDownloadAudio",
    setAutoDownloadDocuments: "setAutoDownloadDocuments",
    setAutoDownloadPhotos: "setAutoDownloadPhotos",
    setAutoDownloadVideos: "setAutoDownloadVideos",

    // Connection & session
    getState: "getState",
    getWWebVersion: "getWWebVersion",
    initialize: "initialize",
    destroy: "destroy",
    logout: "logout",
    resetState: "resetState",
    requestPairingCode: "requestPairingCode",

    // Extra utilities
    getCountryCode: "getCountryCode",
    getFormattedNumber: "getFormattedNumber",
  };

  const actualMethod = methodMap[methodName];

  if (!actualMethod) {
    res.status(403).json({ status: 403, msg: `Method ${methodName} not allowed.` });
    return;
  }

  try {
    console.log(`Attempting to call method: ${actualMethod} with argsName:`, argsName);

    const fn = client[actualMethod as keyof typeof client];
    if (typeof fn !== "function") {
      res
        .status(400)
        .json({ status: 400, msg: `Method ${actualMethod} is not callable.` });
      return;
    }
    let result;


    if (Array.isArray(argsName)) {
      result = await fn(...argsName);
    } else if (argsName !== undefined) {
      result = await fn(argsName);
    } else {
      result = await fn();
    }

    console.log(`Method call result:`, result);

    // Optional: If your API returns error object instead of throwing
    if (result && typeof result === "object" && "error" in result) {
      throw new Error(result.error);
    }

    res.status(200).json({ status: 200, result });
  } catch (error: any) {
    console.error(`Failed to execute ${actualMethod}:`, error.message || error);
    res.status(500).json({
      status: 500,
      msg: `Error executing ${actualMethod}`,
      error: error.message || error,
    });
  }
};

// Retrieve messages for a device
const retrieveMessages = async (req: Request, res: Response): Promise<void> => {
  const { deviceId } = req.body;

  if (!deviceId) {
    res.status(200).json({ status: 401, msg: "Device ID is required." });
    return;
  }

  try {
    if (!messages[deviceId]) {
      res
        .status(200)
        .json({ status: 322, msg: `Device with ID '${deviceId}' not found.` });
      return;
    }
    res
      .status(200)
      .json({ status: 200, deviceId, messages: messages[deviceId] });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error occurred";
    console.error(
      `Error retrieving messages for device ${deviceId}:`,
      errorMessage
    );
    res.status(500).json({ status: 500, msg: "Failed to retrieve messages." });
  }
};

// Send a message to a specific user
const sendMessage = async (req: Request, res: Response): Promise<void> => {
  const { deviceId, number, message, isGroup, chatId, addInFile, file_url } =
    req.body;

  if (!deviceId || !number || !message) {
    res.status(200).json({
      status: 401,
      msg: "Device ID, number, and message are required.",
    });
    return;
  }

  try {
    const client = clients[deviceId];

    if (!client) {
      res
        .status(200)
        .json({ status: 322, msg: `Device with ID '${deviceId}' not found.` });
      return;
    }

    if (addInFile && file_url) {
      try {
        const response = await axios({
          method: "GET",
          url: file_url,
          responseType: "arraybuffer",
        });

        // Convert to base64
        const base64Data = Buffer.from(response.data, "binary").toString(
          "base64"
        );

        // Get mime type from response headers
        const mimeType = response.headers["content-type"];

        // Create MessageMedia object
        const media = new MessageMedia(
          mimeType || "image/jpeg", // fallback to image/jpeg if mime type is not detected
          base64Data,
          "media_file" // filename
        );
        if (isGroup) {
          await client.sendMessage(`${chatId}@g.us`, media, {
            caption: message,
          });
        } else if (chatId) {
          await client.sendMessage(chatId, media, { caption: message });
        } else {
          await client.sendMessage(`${number}@c.us`, media, {
            caption: message,
          });
        }
      } catch (mediaError) {
        console.error("Error loading media:", mediaError);
        res
          .status(500)
          .json({ status: 500, msg: "Failed to load media file." });
        return;
      }
    } else {
      if (isGroup) {
        await client.sendMessage(`${chatId}@g.us`, message);
      } else if (chatId) {
        // Sending to an existing chat (individual or group)
        await client.sendMessage(chatId, message);
      } else {
        await client.sendMessage(`${number}@c.us`, message);
      }
    }
    res
      .status(200)
      .json({ status: 200, message: "Message sent successfully." });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error occurred";
    console.error(
      `Error sending message for device ${deviceId}:`,
      errorMessage
    );
    res.status(500).json({ status: 500, msg: "Failed to send message." });
  }
};

// Disconnect a device
const disconnectDevice = async (req: Request, res: Response): Promise<void> => {
  const { deviceId } = req.body;

  if (!deviceId) {
    res.status(200).json({ status: 401, msg: "Device ID is required." });
    return;
  }

  try {
    const client = clients[deviceId];

    if (!client) {
      res
        .status(200)
        .json({ status: 322, msg: `Device with ID '${deviceId}' not found.` });
      return;
    }

    await client.logout();
    await client.destroy();
    // await new Promise((res) => setTimeout(res, 1000));
    delete clients[deviceId];
    delete status[deviceId];
    delete messages[deviceId];
    res.status(200).json({
      status: 200,
      message: `Device ${deviceId} disconnected successfully.`,
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error occurred";
    console.error(`Error disconnecting device ${deviceId}:`, errorMessage);
    res.status(500).json({
      status: 500,
      msg: `Failed to disconnect device ${deviceId}: ${errorMessage}`,
    });
  }
};

// Reconnect a device
const reconnectDevice = async (req: Request, res: Response): Promise<void> => {
  const { deviceId } = req.body;

  if (!deviceId) {
    res.status(200).json({ status: 401, msg: "Device ID is required." });
    return;
  }

  try {
    const client = clients[deviceId];

    if (!client) {
      res
        .status(200)
        .json({ status: 322, msg: `Device with ID '${deviceId}' not found.` });
      return;
    }

    status[deviceId] = "reconnected";
    const lastReconnected = TimeService.nowFormatted("YYYY-MM-DD");

    const device: Device = {
      id: deviceId,
      status: status[deviceId],
      lastReconnected,
    };

    res.status(200).json({
      status: 200,
      message: `Device '${deviceId}' reconnected successfully.`,
      device,
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error occurred";
    console.error(`Error reconnecting device ${deviceId}:`, errorMessage);
    res.status(500).json({
      status: 500,
      msg: `Failed to reconnect device '${deviceId}': ${errorMessage}`,
    });
  }
};

// Get all groups for a device
const getGroups = async (req: Request, res: Response): Promise<void> => {
  const { deviceId } = req.body;

  if (!deviceId) {
    res.status(200).json({ status: 401, msg: "Device ID is required." });
    return;
  }

  try {
    const client = clients[deviceId];

    if (!client) {
      res
        .status(200)
        .json({ status: 322, msg: `Device with ID '${deviceId}' not found.` });
      return;
    }

    const chats = await client.getChats();
    const groups = chats.filter((chat) => chat.isGroup);
    res.status(200).json({ status: 200, groups });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error occurred";
    console.error(
      `Error fetching groups for device ${deviceId}:`,
      errorMessage
    );
    res.status(500).json({ status: 500, msg: "Failed to fetch groups." });
  }
};

const getChats = async (req: Request, res: Response): Promise<void> => {
  const { deviceId } = req.body;

  if (!deviceId) {
    res.status(200).json({ status: 401, msg: "Device ID is required." });
    return;
  }

  try {
    const client = clients[deviceId];

    if (!client) {
      res
        .status(200)
        .json({ status: 322, msg: `Device with ID '${deviceId}' not found.` });
      return;
    }

    const chats = await client.getChats();
    res.status(200).json({ status: 200, chats });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error occurred";
    console.error(`Error fetching chats for device ${deviceId}:`, errorMessage);
    res.status(500).json({ status: 500, msg: "Failed to fetch chats." });
  }
};

// Get all registered devices
const getDevices = async (req: Request, res: Response): Promise<void> => {
  try {
    const devices = Object.keys(clients).map((deviceId) => ({
      id: deviceId,
      status: status[deviceId],
    }));

    res.status(200).json({ status: 200, devices });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error occurred";
    console.error("Error fetching devices:", errorMessage);
    res.status(500).json({ status: 500, msg: "Failed to fetch devices." });
  }
};

export {
  createDevice,
  checkDeviceStatus,
  retrieveMessages,
  sendMessage,
  disconnectDevice,
  reconnectDevice,
  getGroups,
  getChats,
  getDevices,
  executeWhatsAppMethod,
};
