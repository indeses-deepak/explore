import fs from 'fs/promises';
import path from 'path';
import logger from '../utils/logger';

async function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function safeDeleteFolder(folderPath: string, maxRetries = 10, delayMs = 2000) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      await fs.rm(folderPath, { recursive: true, force: true });
      logger.info(`Deleted folder ${folderPath}`);
      return;
    } catch (err: any) {
      if (err.code === 'EBUSY' || err.code === 'EPERM') {
        logger.warn(`Folder busy, retrying delete attempt ${i + 1}/${maxRetries}: ${err.message}`);
        await delay(delayMs);
      } else if (err.code === 'ENOENT') {
        logger.info(`Folder ${folderPath} does not exist, skipping deletion`);
        return;
      } else {
        logger.error(`Unexpected error deleting folder ${folderPath}: ${err.message}`);
        throw err;
      }
    }
  }
  logger.warn(`Failed to delete folder ${folderPath} after ${maxRetries} retries`);
  throw new Error(`Failed to delete folder ${folderPath} after ${maxRetries} retries`);
}

async function renameLockedFiles(folderPath: string) {
  const defaultPath = path.join(folderPath, 'Default');
  const filesToRename = ['chrome_debug.log', 'Cookies', 'Cookies-journal'];

  try {
    await fs.access(defaultPath);
    for (const file of filesToRename) {
      const filePath = path.join(defaultPath, file);
      const renamedPath = `${filePath}.locked.${Date.now()}`;
      try {
        await fs.rename(filePath, renamedPath);
        logger.info(`Renamed locked file: ${filePath} to ${renamedPath}`);
      } catch (err: any) {
        if (err.code === 'EBUSY') {
          logger.warn(`File ${filePath} is locked (EBUSY)`);
        } else if (err.code !== 'ENOENT') {
          logger.warn(`Rename failed for ${file}: ${err.message}`);
        }
      }
    }
  } catch (err: any) {
    if (err.code !== 'ENOENT') {
      logger.warn(`Error accessing Default folder ${defaultPath}: ${err.message}`);
    }
  }
}

export async function safeLogout(userDataDir: string) {
  try {
    await safeDeleteFolder(userDataDir);
  } catch (err) {
    logger.warn(`Initial delete failed for ${userDataDir}, renaming locked files and retrying...`);
    await renameLockedFiles(userDataDir);
    await safeDeleteFolder(userDataDir);
  }
}