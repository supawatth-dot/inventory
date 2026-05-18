import { licenseQueue, warrantyQueue, slaQueue, redisConnection } from './queue';
import { Worker } from 'bullmq';
import { processLicenseCheck } from './processors/licenseWorker';
import { processWarrantyCheck } from './processors/warrantyWorker';
import { processSLACheck } from './processors/slaWorker';

async function startScheduler() {
  // Cron: check unused licenses daily at 9am
  await licenseQueue.add('check-unused', {}, {
    repeat: { pattern: '0 9 * * *' },
    removeOnComplete: 10,
    removeOnFail: 5,
  });

  // Cron: check warranty expiry daily at 8am
  await warrantyQueue.add('check-expiry', {}, {
    repeat: { pattern: '0 8 * * *' },
    removeOnComplete: 10,
    removeOnFail: 5,
  });

  // Cron: check SLA every 30 minutes
  await slaQueue.add('check-overdue', {}, {
    repeat: { pattern: '*/30 * * * *' },
    removeOnComplete: 10,
    removeOnFail: 5,
  });

  // Workers
  new Worker('license-check', processLicenseCheck, { connection: redisConnection });
  new Worker('warranty-check', processWarrantyCheck, { connection: redisConnection });
  new Worker('sla-check', processSLACheck, { connection: redisConnection });

  console.log('Scheduler and workers started');
}

startScheduler().catch(console.error);
