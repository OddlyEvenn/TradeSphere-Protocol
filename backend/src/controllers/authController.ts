import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { Request, Response } from 'express';
import { prisma } from '../services/PrismaService';

const JWT_SECRET = process.env.JWT_SECRET || 'supersecret';

export const register = async (req: Request, res: Response) => {
    try {
        const { email, password, name, role } = req.body;

        const existingUser = await prisma.user.findUnique({ where: { email } });

        if (existingUser) {
            return res.status(400).json({ message: 'User with this email already exists' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const user = await prisma.user.create({
            data: {
                email,
                password: hashedPassword,
                name,
                role
            }
        });

        const token = jwt.sign({ userId: user.id, role: user.role }, JWT_SECRET, { expiresIn: '1d' });

        res.cookie('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            maxAge: 86400000 // 1 day
        });

        res.status(201).json({
            user: { id: user.id, email: user.email, role: user.role, name: user.name },
            token
        });
    } catch (error: any) {
        console.error('Registration error:', error);
        res.status(500).json({ message: error.message });
    }
};

export const login = async (req: Request, res: Response) => {
    try {
        const { email, password } = req.body;
        const user = await prisma.user.findUnique({ where: { email } });

        if (!user || !(await bcrypt.compare(password, user.password))) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        const token = jwt.sign({ userId: user.id, role: user.role }, JWT_SECRET, { expiresIn: '1d' });

        res.cookie('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            maxAge: 86400000
        });

        res.status(200).json({
            user: { id: user.id, email: user.email, role: user.role, name: user.name, walletAddress: (user as any).walletAddress },
            token
        });
    } catch (error: any) {
        console.error('Login error:', error);
        res.status(500).json({ message: error.message });
    }
};

export const updateWalletAddress = async (req: Request, res: Response) => {
    try {
        const { userId, walletAddress } = req.body;
        const normalizedWallet = walletAddress.toLowerCase();

        // 1. Find if ANY user already has this wallet address
        const existingUser = await (prisma.user as any).findFirst({
            where: { walletAddress: normalizedWallet }
        });

        if (existingUser && existingUser.id !== userId) {
            // Unlink from the old account to allow the new one to claim it
            console.log(`Unlinking wallet ${normalizedWallet} from user ${existingUser.id} to move to ${userId}`);
            await (prisma.user as any).update({
                where: { id: existingUser.id },
                data: { walletAddress: null }
            });
        }

        // 2. Perform the update (or re-update if it was already synced)
        const user = await (prisma.user as any).update({
            where: { id: userId },
            data: { walletAddress: normalizedWallet }
        });

        res.status(200).json({ message: 'Wallet address synchronized', user });
    } catch (error: any) {
        console.error('Update wallet error:', error);
        res.status(500).json({ message: error.message });
    }
};

export const getUsers = async (req: Request, res: Response) => {
    try {
        const { role } = req.query;
        const users = await prisma.user.findMany({
            where: role ? { role: role as any } : {},
            select: {
                id: true,
                email: true,
                name: true,
                role: true,
                walletAddress: true
            }
        });
        res.status(200).json(users);
    } catch (error: any) {
        console.error('Get users error:', error);
        res.status(500).json({ message: error.message });
    }
};

export const clearDatabase = async (req: Request, res: Response) => {
    try {
        console.log('--- DB CLEANUP INITIATED ---');
        // Delete in order to avoid FK issues
        await prisma.tradeEvent.deleteMany({});
        await prisma.document.deleteMany({});
        await prisma.customsVerification.deleteMany({});
        await prisma.billOfLading.deleteMany({});
        await prisma.letterOfCredit.deleteMany({});
        await prisma.marketplaceOffer.deleteMany({});
        await prisma.marketplaceListing.deleteMany({});
        await prisma.trade.deleteMany({});
        await prisma.product.deleteMany({});
        await prisma.category.deleteMany({});

        const userCount = await prisma.user.count();
        res.json({ message: "Database cleared successfully", userCount });
    } catch (error: any) {
        console.error('Cleanup error:', error);
        res.status(500).json({ error: error.message });
    }
};

