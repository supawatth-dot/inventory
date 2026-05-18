import { Router } from 'express';
import employeesRouter from './employees';
import assetsRouter from './assets';
import ticketsRouter from './tickets';
import licensesRouter from './licenses';
import securityRouter from './security';
import dashboardRouter from './dashboard';

const router = Router();

router.use('/employees', employeesRouter);
router.use('/assets', assetsRouter);
router.use('/tickets', ticketsRouter);
router.use('/licenses', licensesRouter);
router.use('/security', securityRouter);
router.use('/dashboard', dashboardRouter);

export default router;
