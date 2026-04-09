import { Redis } from '@upstash/redis';
import { logger } from '../utils/logger';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Redis Service using Upstash REST SDK
 * This allows connecting to Redis over HTTP/REST, which is ideal for serverless or edge environments
 * and avoids common TCP connection issues in production.
 */
class RedisService {
    private client;
    private isConnected: boolean = false;

    constructor() {
        const url = process.env.UPSTASH_REDIS_REST_URL;
        const token = process.env.UPSTASH_REDIS_REST_TOKEN;

        if (!url || !token) {
            logger.warn('Upstash Redis credentials missing. Redis functionality will be disabled.');
            this.client = null;
            return;
        }

        try {
            this.client = new Redis({
                url: url,
                token: token,
            });
            this.isConnected = true;
            logger.info('Redis Client (REST) initialized successfully');
        } catch (error) {
            logger.error('Failed to initialize Upstash Redis client', error);
            this.client = null;
        }
    }

    /**
     * No-op connect method for compatibility with app startup
     * Since this is a REST client, there's no persistent TCP connection to maintain.
     */
    public async connect(): Promise<void> {
        if (this.client) {
            this.isConnected = true;
            logger.success('Redis Service (REST) is Ready');
        } else {
            logger.warn('Redis Service (REST) could not connect - client not initialized');
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
        if (!this.client) return;
        try {
            // Upstash handles serialization/deserialization well, but we'll stick to stringifying objects
            const stringValue = typeof value === 'string' ? value : JSON.stringify(value);
            
            if (expireSeconds) {
                await this.client.set(key, stringValue, {
                    ex: expireSeconds
                });
            } else {
                await this.client.set(key, stringValue);
            }
        } catch (error) {
            logger.error(`Error setting key ${key} in Redis REST`, error);
        }
    }

    /**
     * Get a value from Redis
     */
    public async get<T>(key: string): Promise<T | null> {
        if (!this.client) return null;
        try {
            const value = await this.client.get(key);
            if (!value) return null;

            // Upstash might return the object directly if it's already an object, 
            // but we treat it conservatively.
            if (typeof value === 'object') return value as T;

            try {
                return JSON.parse(value as string) as T;
            } catch {
                return value as unknown as T;
            }
        } catch (error) {
            logger.error(`Error getting key ${key} from Redis REST`, error);
            return null;
        }
    }

    /**
     * Delete a key from Redis
     */
    public async del(key: string): Promise<void> {
        if (!this.client) return;
        try {
            await this.client.del(key);
        } catch (error) {
            logger.error(`Error deleting key ${key} from Redis REST`, error);
        }
    }
}

export const redisService = new RedisService();
export default redisService;

