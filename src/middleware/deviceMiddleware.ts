import { Request, Response, NextFunction } from 'express';
import { clients } from '../state';

// Middleware to validate deviceId in POST requests
const validateDeviceId = (req: Request, res: Response, next: NextFunction): void => {
    const { deviceId } = req.body;

    if (!deviceId) {
        res.status(400).json({ error: 'Device ID is required.' });
        return;
    }
    next();
};

// Middleware to check if the device exists
const checkDeviceExists = (req: Request, res: Response, next: NextFunction): void => {
    const { deviceId } = req.body;

    if (clients[deviceId]) {
        res.status(200).json({ status:205, error: 'Device already exists. test' });
        return;
    }

    next();
};

// Middleware to validate if the device is active
const checkDeviceActive = (req: Request, res: Response, next: NextFunction): void => {
    const { deviceId } = req.body;

    console.log(deviceId); // For debugging purposes

    // Check if device is active by verifying if it exists in clients
    if (!clients[deviceId]) {
        res.status(200).json({ status:205, error: 'Device not found or disconnected.' });
        return;
    }

    next();
};

// Middleware to validate message content
const validateMessageContent = (req: Request, res: Response, next: NextFunction): void => {
    const { number, message } = req.body;

    if (!number || !message) {
        res.status(400).json({ error: 'Number and message are required.' });
        return;
    }

    next();
};

export {
    validateDeviceId,
    checkDeviceExists,
    checkDeviceActive,
    validateMessageContent
};