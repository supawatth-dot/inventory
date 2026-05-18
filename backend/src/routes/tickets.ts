import { Router } from 'express';
import { supabase } from '../lib/supabase';
import { authenticate, AuthRequest } from '../middleware/auth';
import { sendEmail } from '../lib/mailer';
import { notify } from '../lib/webhooks';
import { z } from 'zod';

const router = Router();

const SLA_HOURS: Record<string, number> = { critical: 4, high: 8, medium: 24, low: 72 };

const TicketSchema = z.object({
  title: z.string().min(3),
  description: z.string().min(10),
  priority: z.enum(['critical', 'high', 'medium', 'low']).default('medium'),
  category: z.enum(['hardware', 'software', 'network', 'access', 'security', 'other']).default('other'),
  requester_id: z.string().uuid().optional(),
  requester_email: z.string().email().optional(),
});

const CommentSchema = z.object({
  content: z.string().min(1),
  is_internal: z.boolean().default(false),
});

router.get('/', authenticate, async (req, res, next) => {
  try {
    const { status, priority, assignee_id } = req.query;
    let query = supabase.from('tickets').select(`
      *,
      assignee:employees!assignee_id(full_name),
      requester:employees!requester_id(full_name, email)
    `).order('created_at', { ascending: false });

    if (status) query = query.eq('status', status as string);
    if (priority) query = query.eq('priority', priority as string);
    if (assignee_id) query = query.eq('assignee_id', assignee_id as string);

    const { data, error } = await query;
    if (error) throw error;
    res.json(data);
  } catch (err) { next(err); }
});

router.get('/overdue', authenticate, async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('tickets')
      .select('*, assignee:employees!assignee_id(full_name, email)')
      .lt('sla_due_at', new Date().toISOString())
      .not('status', 'in', '("resolved","closed")');
    if (error) throw error;
    res.json(data);
  } catch (err) { next(err); }
});

router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('tickets')
      .select(`*, assignee:employees!assignee_id(*), requester:employees!requester_id(*), ticket_comments(*)`)
      .eq('id', req.params.id)
      .single();
    if (error) throw error;
    if (!data) { res.status(404).json({ error: 'Not found' }); return; }
    res.json(data);
  } catch (err) { next(err); }
});

router.post('/', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const body = TicketSchema.parse(req.body);
    const slaHours = SLA_HOURS[body.priority];
    const sla_due_at = new Date(Date.now() + slaHours * 3600 * 1000).toISOString();

    // Auto-assign: pick IT staff with fewest open tickets
    const { data: staff } = await supabase
      .from('employees')
      .select('id, full_name')
      .eq('status', 'active')
      .eq('department_id', req.query.it_dept_id as string || '');

    const assignee_id = staff?.[0]?.id || null;

    const { data, error } = await supabase.from('tickets').insert({
      ...body,
      sla_due_at,
      assignee_id,
      status: 'open',
      ticket_number: `TKT-${Date.now()}`,
    }).select().single();
    if (error) throw error;

    if (body.requester_email) {
      await sendEmail(body.requester_email, `Ticket Created: ${body.title}`, `
        <p>Your ticket <strong>${(data as any).ticket_number}</strong> has been received.</p>
        <p>Priority: ${body.priority} | SLA Due: ${new Date(sla_due_at).toLocaleString()}</p>
      `);
    }
    if (body.priority === 'critical') {
      await notify('CRITICAL Ticket Created', `${(data as any).ticket_number}: ${body.title}\nSLA Due: ${new Date(sla_due_at).toLocaleString()}`);
    }

    res.status(201).json(data);
  } catch (err) { next(err); }
});

router.patch('/:id', authenticate, async (req, res, next) => {
  try {
    const allowed = z.object({
      status: z.enum(['open', 'in_progress', 'pending', 'resolved', 'closed']).optional(),
      assignee_id: z.string().uuid().optional(),
      priority: z.enum(['critical', 'high', 'medium', 'low']).optional(),
      resolution: z.string().optional(),
    }).parse(req.body);

    const update: Record<string, unknown> = { ...allowed };
    if (allowed.status === 'resolved') update.resolved_at = new Date().toISOString();

    const { data, error } = await supabase.from('tickets').update(update).eq('id', req.params.id).select().single();
    if (error) throw error;
    res.json(data);
  } catch (err) { next(err); }
});

router.post('/:id/comments', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const body = CommentSchema.parse(req.body);
    const { data, error } = await supabase.from('ticket_comments').insert({
      ticket_id: req.params.id,
      author_id: req.user!.id,
      ...body,
    }).select().single();
    if (error) throw error;
    res.status(201).json(data);
  } catch (err) { next(err); }
});

export default router;
