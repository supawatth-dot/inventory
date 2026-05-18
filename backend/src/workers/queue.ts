import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import { env } from '../config/env';

export const redisConnection = new IORedis({
  host: env.REDIS_HOST,
  port: env.REDIS_PORT,
  password: env.REDIS_PASSWORD || undefined,
  maxRetriesPerRequest: null,
});

export const licenseQueue = new Queue('license-check', { connection: redisConnection });
export const warrantyQueue = new Queue('warranty-check', { connection: redisConnection });
export const slaQueue = new Queue('sla-check', { connection: redisConnection });
