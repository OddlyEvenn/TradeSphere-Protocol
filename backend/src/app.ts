import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import dotenv from 'dotenv';
import morgan from 'morgan';
import authRoutes from './routes/authRoutes';
import tradeRoutes from './routes/tradeRoutes';
import marketplaceRoutes from './routes/marketplaceRoutes';
import userRoutes from './routes/userRoutes';
import documentRoutes from './routes/documentRoutes';
import { EventListenerService } from './services/EventListenerService';
import { redisService } from './services/RedisService';
import { logger } from './utils/logger';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(morgan('dev')); // GET/POST/PUT logs
const allowedOrigins = process.env.FRONTEND_URLS ? process.env.FRONTEND_URLS.split(',') : ['http://localhost:5173'];

app.use(cors({
    origin: allowedOrigins,
    credentials: true
}));
app.use(express.json());
app.use(cookieParser());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/trades', tradeRoutes);
app.use('/api/marketplace', marketplaceRoutes);
app.use('/api/users', userRoutes);
app.use('/api/documents', documentRoutes);

app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date() });
});

app.listen(PORT, async () => {
    logger.info(`Backend server running on port ${PORT}`);

    // Initialize Redis Caching
    try {
        await redisService.connect();
    } catch (error) {
        logger.error("Failed to connect to Redis during startup:", error);
    }

    // Start Blockchain Event Listeners
    try {
        await EventListenerService.startListeners();
    } catch (error) {
        logger.error("Failed to start Blockchain Listeners:", error);
    }
});
