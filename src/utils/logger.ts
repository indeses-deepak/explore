import winston from 'winston';
import path from 'path';
import fs from 'fs';
const moment = require('moment-timezone');

// Ensure log directory exists
const logDir = path.resolve(__dirname, '../../logs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

// Create the logger
// const logger = winston.createLogger({
//   level: 'info',  // Change to 'debug' for verbose logging
//   format: winston.format.combine(
//     winston.format.timestamp(),
//     winston.format.json()  // Log as JSON (good for production & log aggregators)
//   ),
//   transports: [
//     new winston.transports.File({ filename: path.join(logDir, 'error.log'), level: 'error' }),
//     new winston.transports.File({ filename: path.join(logDir, 'combined.log') }),
//   ],
// });


const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp({
      format: () => moment().tz('Asia/Kolkata').format()  
    }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: path.join(logDir, 'error.log'), level: 'error' }),
    new winston.transports.File({ filename: path.join(logDir, 'combined.log') }),
  ],
});

//for example you can also this   
// format: () => moment().tz('Asia/Kolkata').format('DD-MM-YYYY HH:mm:ss')

// Only log to console in development
// if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.simple()
  }));
// }

export default logger;
