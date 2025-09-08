import { Request, Response, NextFunction } from 'express';
import winston from 'winston';

// Set up winston logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'api_responses.log' }),
    new winston.transports.Console()
  ]
});

// Logging middleware
const logApiRequestResponse = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  // Capture the start time for response time logging
  const start = Date.now();

  // Log request details (for all methods)
  logger.info('API Request', {
    method: req.method,
    url: req.originalUrl,
    headers: req.headers,  // Logging headers
    body: req.body,  // Logging request body
    query: req.query,  // Logging query parameters
    timestamp: new Date().toISOString().slice(0, 19).replace("T", " ")
  });

  // Create a custom function to log response after the response is finished
  const logResponse = () => {
    const duration = Date.now() - start; // Calculate duration
    logger.info('API Response', {
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      responseBody: res.locals.responseBody || 'No response body',
      responseTime: duration,
      timestamp: new Date().toISOString().slice(0, 19).replace("T", " ")
    });
  };

  // Monkey patch res.send and res.json to capture the response body
  const originalSend = res.send;
  res.send = function (body) {
    res.locals.responseBody = body;
    return originalSend.call(this, body);
  };

  const originalJson = res.json;
  res.json = function (body) {
    res.locals.responseBody = body;
    return originalJson.call(this, body);
  };

  // Register the log response function to be executed after the response ends
  // res.on('finish', logResponse);

  // Proceed to the next middleware or route handler
  next();
};

export default logApiRequestResponse;