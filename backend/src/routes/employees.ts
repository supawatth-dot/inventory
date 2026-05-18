import { Router } from 'express';
import { supabase } from '../lib/supabase';
import { authenticate } from '../middleware/auth';
import { sendEmail } from '../lib/mailer';
import { notify } from '../lib/webhooks';
import { z } from 'zod';

const router = Router();

const EmployeeSchema = z.object({
  full_name: z.string().min(2),
  email: z.string().email(),
  department_id: z.string().uuid().optional(),
  job_title: z.string().min(1),
  hire_date: z.string(),
  status: z.enum(['active', 'inactive', 'offboarding']).default('active'),
  manager_id: z.string().uuid().optional(),
  phone: z.string().optional(),
  location: z.string().optional(),
});

// GET /employees
router.get('/', authenticate, async (req, res, next) => {
  try {
    const { status, department_id, search } = req.query;
    let query = supabase.from('employees').select(`
      *,
      departments(name),
      manager:employees!manager_id(full_name)
    `).order('full_name');

    if (status) query = query.eq('status', status as string);
    if (department_id) query = query.eq('department_id', department_id as string);
    if (search) query = query.ilike('full_name', `%${search}%`);

    const { data, error } = await query;
    if (error) throw error;
    res.json(data);
  } catch (err) { next(err); }
});

// GET /employees/:id
router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('employees')
      .select(`*, departments(name), manager:employees!manager_id(full_name)`)
      .eq('id', req.params.id)
      .single();
    if (error) throw error;
    if (!data) { res.status(404).json({ error: 'Not found' }); return; }
    res.json(data);
  } catch (err) { next(err); }
});

// POST /employees (onboarding)
router.post('/', authenticate, async (req, res, next) => {
  try {
    const body = EmployeeSchema.parse(req.body);
    const { data, error } = await supabase.from('employees').insert(body).select().single();
    if (error) throw error;

    // Trigger onboarding notifications
    await Promise.allSettled([
      sendEmail(body.email, 'Welcome to the Team!', `
        <h2>Welcome, ${body.full_name}!</h2>
        <p>Your account has been created. Your IT setup will be ready on your start date (${body.hire_date}).</p>
      `),
      notify('New Employee Onboarding', `${body.full_name} (${body.email}) joins on ${body.hire_date} as ${body.job_title}.`),
    ]);

    await supabase.from('audit_logs').insert({
      action: 'employee_created',
      entity_type: 'employee',
      entity_id: data.id,
      details: { full_name: body.full_name, email: body.email },
    });

    res.status(201).json(data);
  } catch (err) { next(err); }
});

// PATCH /employees/:id
router.patch('/:id', authenticate, async (req, res, next) => {
  try {
    const body = EmployeeSchema.partial().parse(req.body);
    const { data, error } = await supabase
      .from('employees').update(body).eq('id', req.params.id).select().single();
    if (error) throw error;

    // Offboarding trigger
    if (body.status === 'offboarding') {
      await notify('Employee Offboarding Started', `${data.full_name} status changed to offboarding. Please revoke access and collect assets.`);
    }

    await supabase.from('audit_logs').insert({
      action: 'employee_updated',
      entity_type: 'employee',
      entity_id: req.params.id,
      details: body,
    });

    res.json(data);
  } catch (err) { next(err); }
});

// DELETE /employees/:id (soft delete via status)
router.delete('/:id', authenticate, async (req, res, next) => {
  try {
    const { error } = await supabase
      .from('employees').update({ status: 'inactive' }).eq('id', req.params.id);
    if (error) throw error;
    await supabase.from('audit_logs').insert({
      action: 'employee_deactivated',
      entity_type: 'employee',
      entity_id: req.params.id,
      details: {},
    });
    res.status(204).send();
  } catch (err) { next(err); }
});

export default router;
