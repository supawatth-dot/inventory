import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { env } from './config/env';
import apiRouter from './routes/index';
import { errorHandler } from './middleware/errorHandler';
import { startRealtimeSubscriptions } from './realtime/subscriptions';

const app = express();

app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN || '*', credentials: true }));
app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));

app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 200, standardHeaders: true }));

app.get('/health', (_, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));
app.use('/api/v1', apiRouter);
app.use(errorHandler);

app.listen(env.PORT, () => {
  console.log(`Server running on port ${env.PORT} [${env.NODE_ENV}]`);
  startRealtimeSubscriptions();
});

export default app;
