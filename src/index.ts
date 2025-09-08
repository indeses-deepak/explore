import express, { Request, Response } from 'express';
import cors from 'cors';
import deviceRoutes from './routes/deviceRoutes';
import { clients, status, messages } from './state'; // Import shared state module
import dotenv from 'dotenv';
import logger from './middleware/logger';
import { checkApiKey } from './middleware/checkApiKeyMiddleware';
dotenv.config();
const app = express();
const port = process.env.PORT || 3000;
const origin = process.env.ORIGIN || '*';


// Configure CORS (Cross-Origin Resource Sharing)
app.use(cors({
    origin: origin, // You can also use '*' to allow all domains (not recommended for production)
    methods: ['GET', 'POST'], // Customize allowed methods as needed
    allowedHeaders: ['Content-Type', 'Authorization'], // Customize allowed headers as needed
}));
app.use(express.urlencoded({ extended: true }));
// Use JSON parsing middleware

// Use the logger middleware
app.use(logger);
app.use(express.json());

// Use the checkApiKey middleware
// app.use(checkApiKey);

// Use the device routes
app.use('/api/device', deviceRoutes);

// Default route to test server is running
app.get('/', (req: Request, res: Response) => {
    res.send('Server is running');
});

// Start the server
app.listen(port, () => {
    console.log(`Node.js server running on http://localhost:${port}`);
});
