/**
 * Cache usando PostgreSQL do Supabase
 * Alternativa ao Redis (mais lento mas funcional)
 */

import prisma from './database';
import { logger } from '../utils/logger';

export const cachePg = {
  async get(key: string): Promise<string | null> {
    try {
      const result = await prisma.$queryRaw`
        SELECT value FROM "Cache" 
        WHERE key = ${key} 
        AND expires_at > NOW()
      `;
      return (result as any)[0]?.value || null;
    } catch (error) {
      return null;
    }
  },

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    try {
      const expiresAt = ttlSeconds 
        ? new Date(Date.now() + ttlSeconds * 1000)
        : new Date(Date.now() + 3600 * 1000); // 1 hora default

      await prisma.$executeRaw`
        INSERT INTO "Cache" (key, value, expires_at)
        VALUES (${key}, ${value}, ${expiresAt})
        ON CONFLICT (key) 
        DO UPDATE SET value = ${value}, expires_at = ${expiresAt}
      `;
    } catch (error) {
      logger.error('Cache set error:', error);
    }
  },

  async del(key: string): Promise<void> {
    try {
      await prisma.$executeRaw`DELETE FROM "Cache" WHERE key = ${key}`;
    } catch (error) {
      logger.error('Cache del error:', error);
    }
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

export default cachePg;
