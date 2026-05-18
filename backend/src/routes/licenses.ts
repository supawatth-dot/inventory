import { Router } from 'express';
import { supabase } from '../lib/supabase';
import { authenticate } from '../middleware/auth';
import { z } from 'zod';

const router = Router();

const LicenseSchema = z.object({
  software_name: z.string().min(1),
  vendor: z.string().optional(),
  license_key: z.string().optional(),
  license_type: z.enum(['per_user', 'per_device', 'site', 'concurrent']).default('per_user'),
  total_seats: z.number().int().positive(),
  expiry_date: z.string().optional(),
  cost_per_seat: z.number().optional(),
  owner_email: z.string().email().optional(),
});

router.get('/', authenticate, async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('licenses')
      .select('*')
      .order('software_name');
    if (error) throw error;
    res.json(data);
  } catch (err) { next(err); }
});

router.get('/unused', authenticate, async (req, res, next) => {
  try {
    const days = parseInt(req.query.days as string || '45', 10);
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);

    const { data, error } = await supabase
      .from('licenses')
      .select('*')
      .lt('last_used_at', cutoff.toISOString())
      .eq('status', 'active');
    if (error) throw error;
    res.json(data);
  } catch (err) { next(err); }
});

router.post('/', authenticate, async (req, res, next) => {
  try {
    const body = LicenseSchema.parse(req.body);
    const { data, error } = await supabase.from('licenses').insert({ ...body, status: 'active' }).select().single();
    if (error) throw error;
    res.status(201).json(data);
  } catch (err) { next(err); }
});

router.patch('/:id', authenticate, async (req, res, next) => {
  try {
    const body = LicenseSchema.partial().parse(req.body);
    const { data, error } = await supabase.from('licenses').update(body).eq('id', req.params.id).select().single();
    if (error) throw error;
    res.json(data);
  } catch (err) { next(err); }
});

router.delete('/:id', authenticate, async (req, res, next) => {
  try {
    const { error } = await supabase.from('licenses').update({ status: 'inactive' }).eq('id', req.params.id);
    if (error) throw error;
    res.status(204).send();
  } catch (err) { next(err); }
});

export default router;
