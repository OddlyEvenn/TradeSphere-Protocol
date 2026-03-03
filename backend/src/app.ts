import express from 'express';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import morgan from 'morgan';
import authRoutes from './routes/authRoutes';
import tradeRoutes from './routes/tradeRoutes';
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(morgan('dev')); // GET/POST/PUT logs
app.use(express.json());
app.use(cookieParser());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/trades', tradeRoutes);

app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date() });
});

app.listen(PORT, () => {
    console.log(`Backend server running on port ${PORT}`);
});
