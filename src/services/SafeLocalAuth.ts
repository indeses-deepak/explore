import fs from 'fs/promises';
import path from 'path';
import { LocalAuth } from 'whatsapp-web.js';
import logger from '../utils/logger';
import { safeLogout } from './safeLogout';

interface LocalAuthWithClientId extends LocalAuth {
  clientId?: string;
}

export class SafeLocalAuth extends LocalAuth {
  logout = async (): Promise<void> => {
    const deviceId = (this as LocalAuthWithClientId).clientId;
    if (!deviceId) {
      logger.warn('Device ID is missing');
      throw new Error('Device ID is missing');
    }

    const folderPath = path.join(
      path.resolve(__dirname, '..', '..'),
      '.wwebjs_auth',
      `session-${deviceId}`
    );
    logger.info(`Attempting to delete session folder: ${folderPath}`);

    try {
      await fs.access(folderPath);
      await safeLogout(folderPath);
      logger.info(`Successfully deleted session folder for device ${deviceId}`);
    } catch (error: any) {
      if (error.code !== 'ENOENT') {
        logger.error(`Error deleting session folder for device ${deviceId}: ${error.message}`);
        throw new Error(`Error deleting session folder: ${error.message}`);
      } else {
        logger.info(`Session folder ${folderPath} already deleted or does not exist`);
      }
    }
  };
}