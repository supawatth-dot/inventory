import { Router } from 'express';
import { supabase } from '../lib/supabase';
import { authenticate } from '../middleware/auth';
import { notify } from '../lib/webhooks';
import { z } from 'zod';

const router = Router();

const AssetSchema = z.object({
  name: z.string().min(1),
  asset_type: z.enum(['laptop', 'desktop', 'monitor', 'phone', 'tablet', 'server', 'network', 'other']),
  serial_number: z.string().optional(),
  model: z.string().optional(),
  manufacturer: z.string().optional(),
  purchase_date: z.string().optional(),
  warranty_expiry: z.string().optional(),
  status: z.enum(['available', 'assigned', 'maintenance', 'retired']).default('available'),
  notes: z.string().optional(),
  cost: z.number().optional(),
});

const AssignmentSchema = z.object({
  employee_id: z.string().uuid(),
  assigned_date: z.string(),
  notes: z.string().optional(),
});

router.get('/', authenticate, async (req, res, next) => {
  try {
    const { status, asset_type } = req.query;
    let query = supabase.from('assets').select(`
      *,
      asset_assignments(
        id, assigned_date, returned_date,
        employee:employees(full_name, email)
      )
    `).order('name');

    if (status) query = query.eq('status', status as string);
    if (asset_type) query = query.eq('asset_type', asset_type as string);

    const { data, error } = await query;
    if (error) throw error;
    res.json(data);
  } catch (err) { next(err); }
});

router.get('/expiring-warranty', authenticate, async (req, res, next) => {
  try {
    const days = parseInt(req.query.days as string || '30', 10);
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() + days);

    const { data, error } = await supabase
      .from('assets')
      .select('*')
      .lte('warranty_expiry', cutoff.toISOString().split('T')[0])
      .gte('warranty_expiry', new Date().toISOString().split('T')[0])
      .neq('status', 'retired');
    if (error) throw error;
    res.json(data);
  } catch (err) { next(err); }
});

router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('assets')
      .select(`*, asset_assignments(*, employee:employees(full_name, email))`)
      .eq('id', req.params.id)
      .single();
    if (error) throw error;
    if (!data) { res.status(404).json({ error: 'Not found' }); return; }
    res.json(data);
  } catch (err) { next(err); }
});

router.post('/', authenticate, async (req, res, next) => {
  try {
    const body = AssetSchema.parse(req.body);
    const { data, error } = await supabase.from('assets').insert(body).select().single();
    if (error) throw error;
    await supabase.from('audit_logs').insert({
      action: 'asset_created', entity_type: 'asset', entity_id: data.id, details: { name: body.name },
    });
    res.status(201).json(data);
  } catch (err) { next(err); }
});

router.patch('/:id', authenticate, async (req, res, next) => {
  try {
    const body = AssetSchema.partial().parse(req.body);
    const { data, error } = await supabase.from('assets').update(body).eq('id', req.params.id).select().single();
    if (error) throw error;
    res.json(data);
  } catch (err) { next(err); }
});

router.delete('/:id', authenticate, async (req, res, next) => {
  try {
    const { error } = await supabase.from('assets').update({ status: 'retired' }).eq('id', req.params.id);
    if (error) throw error;
    res.status(204).send();
  } catch (err) { next(err); }
});

// Assign asset to employee
router.post('/:id/assign', authenticate, async (req, res, next) => {
  try {
    const body = AssignmentSchema.parse(req.body);
    const { data: assignment, error: ae } = await supabase
      .from('asset_assignments')
      .insert({ asset_id: req.params.id, ...body })
      .select(`*, employee:employees(full_name), asset:assets(name)`)
      .single();
    if (ae) throw ae;

    await supabase.from('assets').update({ status: 'assigned' }).eq('id', req.params.id);
    await notify('Asset Assigned', `${(assignment as any).asset.name} assigned to ${(assignment as any).employee.full_name}`);
    res.status(201).json(assignment);
  } catch (err) { next(err); }
});

// Return asset
router.post('/:id/return', authenticate, async (req, res, next) => {
  try {
    const { error } = await supabase
      .from('asset_assignments')
      .update({ returned_date: new Date().toISOString().split('T')[0] })
      .eq('asset_id', req.params.id)
      .is('returned_date', null);
    if (error) throw error;
    await supabase.from('assets').update({ status: 'available' }).eq('id', req.params.id);
    res.json({ message: 'Asset returned' });
  } catch (err) { next(err); }
});

export default router;
