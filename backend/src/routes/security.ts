import { Router } from 'express';
import { supabase } from '../lib/supabase';
import { authenticate } from '../middleware/auth';
import { notify } from '../lib/webhooks';
import { z } from 'zod';

const router = Router();

function computeRiskScore(factors: {
  mfa_enabled: boolean;
  password_age_days: number;
  phishing_failures: number;
  device_compliant: boolean;
  security_training_complete: boolean;
}): number {
  let score = 100;
  if (!factors.mfa_enabled) score -= 25;
  if (factors.password_age_days > 90) score -= 20;
  else if (factors.password_age_days > 60) score -= 10;
  if (factors.phishing_failures > 2) score -= 25;
  else if (factors.phishing_failures > 0) score -= 10;
  if (!factors.device_compliant) score -= 20;
  if (!factors.security_training_complete) score -= 10;
  return Math.max(0, score);
}

router.get('/risk-scores', authenticate, async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('risk_scores')
      .select('*, employee:employees(full_name, email, department_id, departments(name))')
      .order('score', { ascending: true });
    if (error) throw error;
    res.json(data);
  } catch (err) { next(err); }
});

router.get('/risk-scores/:employeeId', authenticate, async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('risk_scores')
      .select('*')
      .eq('employee_id', req.params.employeeId)
      .order('assessed_at', { ascending: false })
      .limit(10);
    if (error) throw error;
    res.json(data);
  } catch (err) { next(err); }
});

router.post('/assess/:employeeId', authenticate, async (req, res, next) => {
  try {
    const factors = z.object({
      mfa_enabled: z.boolean(),
      password_age_days: z.number().int().min(0),
      phishing_failures: z.number().int().min(0),
      device_compliant: z.boolean(),
      security_training_complete: z.boolean(),
    }).parse(req.body);

    const score = computeRiskScore(factors);
    const risk_level = score >= 80 ? 'low' : score >= 60 ? 'medium' : score >= 40 ? 'high' : 'critical';

    const { data, error } = await supabase.from('risk_scores').insert({
      employee_id: req.params.employeeId,
      score,
      risk_level,
      factors,
      assessed_at: new Date().toISOString(),
    }).select().single();
    if (error) throw error;

    if (risk_level === 'critical' || risk_level === 'high') {
      const { data: emp } = await supabase.from('employees').select('full_name').eq('id', req.params.employeeId).single();
      await notify(
        `Security Risk Alert: ${risk_level.toUpperCase()}`,
        `${(emp as any)?.full_name || 'Employee'} has a ${risk_level} risk score of ${score}/100. Immediate action required.`
      );
    }

    res.status(201).json(data);
  } catch (err) { next(err); }
});

router.get('/training', authenticate, async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('security_training')
      .select('*, employee:employees(full_name, email)')
      .order('due_date');
    if (error) throw error;
    res.json(data);
  } catch (err) { next(err); }
});

router.post('/training', authenticate, async (req, res, next) => {
  try {
    const body = z.object({
      employee_id: z.string().uuid(),
      training_name: z.string(),
      due_date: z.string(),
      completed_at: z.string().optional(),
      score: z.number().optional(),
    }).parse(req.body);

    const { data, error } = await supabase.from('security_training').insert(body).select().single();
    if (error) throw error;
    res.status(201).json(data);
  } catch (err) { next(err); }
});

export default router;
