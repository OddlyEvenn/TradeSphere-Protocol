import { createClient } from 'redis';
import { logger } from '../utils/logger';
import dotenv from 'dotenv';

dotenv.config();

class RedisService {
    private client;
    private isConnected: boolean = false;

    constructor() {
        const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

        this.client = createClient({
            url: redisUrl
        });

        this.client.on('error', (err) => {
            logger.error('Redis Client Error', err);
            this.isConnected = false;
        });

        this.client.on('connect', () => {
            logger.info('Redis Client Connecting...');
        });

        this.client.on('ready', () => {
            logger.success('Redis Client Ready and Connected');
            this.isConnected = true;
        });

        this.client.on('end', () => {
            logger.warn('Redis Client Connection Ended');
            this.isConnected = false;
        });
    }

    public async connect(): Promise<void> {
        if (!this.isConnected) {
            try {
                await this.client.connect();
            } catch (error) {
                logger.error('Failed to connect to Redis', error);
                throw error;
            }
        }
    }

    public getClient() {
        return this.client;
    }

    public getIsConnected(): boolean {
        return this.isConnected;
    }

    /**
     * Set a value in Redis with optional expiration (in seconds)
     */
    public async set(key: string, value: any, expireSeconds?: number): Promise<void> {
        try {
            const stringValue = typeof value === 'string' ? value : JSON.stringify(value);
            if (expireSeconds) {
                await this.client.set(key, stringValue, {
                    EX: expireSeconds
                });
            } else {
                await this.client.set(key, stringValue);
            }
        } catch (error) {
            logger.error(`Error setting key ${key} in Redis`, error);
        }
    }

    /**
     * Get a value from Redis
     */
    public async get<T>(key: string): Promise<T | null> {
        try {
            const value = await this.client.get(key);
            if (!value) return null;

            try {
                return JSON.parse(value) as T;
            } catch {
                return value as unknown as T;
            }
        } catch (error) {
            logger.error(`Error getting key ${key} from Redis`, error);
            return null;
        }
    }

    /**
     * Delete a key from Redis
     */
    public async del(key: string): Promise<void> {
        try {
            await this.client.del(key);
        } catch (error) {
            logger.error(`Error deleting key ${key} from Redis`, error);
        }
    }
}

export const redisService = new RedisService();
export default redisService;
