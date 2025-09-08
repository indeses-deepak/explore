import { Client } from 'whatsapp-web.js';

type DeviceState = 'ready' | 'failed' | 'disconnected' | 'initializing' | 'reconnected';

interface ClientMap {
    [deviceId: string]: Client;
}

interface StatusMap {
    [deviceId: string]: DeviceState;
}

interface MessageMap {
    [deviceId: string]: any[];
}

interface deleteMap {
    [deviceId: string]: any;
}

export const clients: ClientMap = {};
export const status: StatusMap = {};
export const messages: MessageMap = {};
export const logsClient: deleteMap = {};