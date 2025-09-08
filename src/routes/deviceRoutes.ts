import express, { Request, Response, NextFunction } from 'express';
const router = express.Router();

import {
    createDevice,
    checkDeviceStatus,
    retrieveMessages,
    sendMessage,
    disconnectDevice,
    reconnectDevice,
    getDevices,
    getChats,
    getGroups,
    executeWhatsAppMethod
} from '../controllers/deviceController';

import {
    validateDeviceId,
    checkDeviceExists,
    checkDeviceActive,
    validateMessageContent
} from '../middleware/deviceMiddleware';

// Type the middleware function signatures
type MiddlewareFunction = (req: Request, res: Response, next: NextFunction) => void;

// Create a device
// router.post('/create', [validateDeviceId, checkDeviceExists] as MiddlewareFunction[], createDevice);
router.post('/create', [validateDeviceId] as MiddlewareFunction[], createDevice);

// Check the status of a device
router.post('/status', [validateDeviceId] as MiddlewareFunction[], checkDeviceStatus);

// Check the status of a device
router.post('/execute', [validateDeviceId,checkDeviceActive] as MiddlewareFunction[], executeWhatsAppMethod);


// Retrieve messages for a device
router.post('/messages', [checkDeviceActive] as MiddlewareFunction[], retrieveMessages);

// Send a message to a specific user
router.post('/send-message', [checkDeviceActive, validateMessageContent] as MiddlewareFunction[], sendMessage);

// Disconnect a device
router.post('/disconnect', [checkDeviceActive] as MiddlewareFunction[], disconnectDevice);

// Reconnect a device
router.post('/reconnect', [validateDeviceId] as MiddlewareFunction[], reconnectDevice);

// Get all groups for a device
router.post('/groups', [checkDeviceActive] as MiddlewareFunction[], getGroups);

// Get all chats for a device
router.post('/chats', [checkDeviceActive] as MiddlewareFunction[], getChats);

// Get all registered devices
router.get('/devices', getDevices);

export default router;
