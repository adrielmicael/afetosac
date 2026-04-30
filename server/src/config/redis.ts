import Redis from 'ioredis';
import { logger } from '../utils/logger';
import { cachePg } from './cachePg';

const redisUrl = process.env.REDIS_URL;

// Redis é OPCIONAL - se não configurado, usa PostgreSQL
let redis: Redis | null = null;

if (redisUrl) {
  redis = new Redis(redisUrl, {
    maxRetriesPerRequest: 3,
    retryStrategy: (times) => {
      if (times > 3) {
        logger.warn('Redis connection failed, falling back to PostgreSQL cache');
        return null;
      }
      return Math.min(times * 100, 3000);
    },
  });

  redis.on('connect', () => {
    logger.info('Redis connected');
  });

  redis.on('error', (err) => {
    logger.error('Redis error:', err);
  });
} else {
  logger.info('No REDIS_URL configured, using PostgreSQL for cache');
}

// Cache helper - usa Redis se disponível, senão PostgreSQL
export const cache = {
  async get(key: string): Promise<string | null> {
    if (redis) {
      try {
        return await redis.get(key);
      } catch (error) {
        logger.warn('Redis get failed, using PostgreSQL');
      }
    }
    return cachePg.get(key);
  },

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (redis) {
      try {
        if (ttlSeconds) {
          await redis.setex(key, ttlSeconds, value);
        } else {
          await redis.set(key, value);
        }
        return;
      } catch (error) {
        logger.warn('Redis set failed, using PostgreSQL');
      }
    }
    return cachePg.set(key, value, ttlSeconds);
  },

  async del(key: string): Promise<void> {
    if (redis) {
      try {
        await redis.del(key);
        return;
      } catch (error) {
        logger.warn('Redis del failed, using PostgreSQL');
      }
    }
    return cachePg.del(key);
  },

  async delPattern(pattern: string): Promise<void> {
    if (redis) {
      try {
        const keys = await redis.keys(pattern);
        if (keys.length > 0) {
          await redis.del(...keys);
        }
        return;
      } catch (error) {
        logger.warn('Redis delPattern failed');
      }
    }
    // PostgreSQL não suporta pattern delete facilmente
    // Ignorar ou implementar com query raw
  },

  async getJSON<T>(key: string): Promise<T | null> {
    const data = await this.get(key);
    if (data) {
      try {
        return JSON.parse(data) as T;
      } catch {
        return null;
      }
    }
    return null;
  },

  async setJSON(key: string, value: any, ttlSeconds?: number): Promise<void> {
    await this.set(key, JSON.stringify(value), ttlSeconds);
  },
};

// Cache keys com namespace por tenant
export const cacheKeys = {
  organization: (id: string) => `org:${id}`,
  user: (id: string) => `user:${id}`,
  userOrganizations: (userId: string) => `user:${userId}:orgs`,
  chat: (id: string) => `chat:${id}`,
  chats: (orgId: string) => `org:${orgId}:chats`,
  patients: (orgId: string) => `org:${orgId}:patients`,
  dashboard: (orgId: string) => `org:${orgId}:dashboard`,
  rateLimit: (identifier: string) => `ratelimit:${identifier}`,
  session: (token: string) => `session:${token}`,
  lock: (resource: string) => `lock:${resource}`,
};

export { redis };

export default redis;
