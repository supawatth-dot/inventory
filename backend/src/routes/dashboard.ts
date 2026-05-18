import { Router } from 'express';
import { supabase } from '../lib/supabase';
import { authenticate } from '../middleware/auth';

const router = Router();

router.get('/summary', authenticate, async (req, res, next) => {
  try {
    const [
      { count: totalEmployees },
      { count: activeEmployees },
      { count: openTickets },
      { count: criticalTickets },
      { count: totalAssets },
      { count: availableAssets },
      { data: riskData },
      { data: slaOverdue },
    ] = await Promise.all([
      supabase.from('employees').select('*', { count: 'exact', head: true }),
      supabase.from('employees').select('*', { count: 'exact', head: true }).eq('status', 'active'),
      supabase.from('tickets').select('*', { count: 'exact', head: true }).not('status', 'in', '("resolved","closed")'),
      supabase.from('tickets').select('*', { count: 'exact', head: true }).eq('priority', 'critical').not('status', 'in', '("resolved","closed")'),
      supabase.from('assets').select('*', { count: 'exact', head: true }),
      supabase.from('assets').select('*', { count: 'exact', head: true }).eq('status', 'available'),
      supabase.from('risk_scores').select('risk_level').order('assessed_at', { ascending: false }),
      supabase.from('tickets').select('id, priority, title, sla_due_at').lt('sla_due_at', new Date().toISOString()).not('status', 'in', '("resolved","closed")'),
    ]);

    const riskCounts = (riskData || []).reduce<Record<string, number>>((acc, r) => {
      acc[r.risk_level] = (acc[r.risk_level] || 0) + 1;
      return acc;
    }, {});

    res.json({
      employees: { total: totalEmployees, active: activeEmployees },
      tickets: { open: openTickets, critical: criticalTickets, sla_overdue: slaOverdue?.length || 0 },
      assets: { total: totalAssets, available: availableAssets },
      security: { risk_distribution: riskCounts },
    });
  } catch (err) { next(err); }
});

router.get('/activity', authenticate, async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('audit_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);
    if (error) throw error;
    res.json(data);
  } catch (err) { next(err); }
});

router.get('/tickets/by-priority', authenticate, async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('tickets')
      .select('priority, status')
      .not('status', 'in', '("resolved","closed")');
    if (error) throw error;
    const grouped = (data || []).reduce<Record<string, number>>((acc, t) => {
      acc[t.priority] = (acc[t.priority] || 0) + 1;
      return acc;
    }, {});
    res.json(grouped);
  } catch (err) { next(err); }
});

router.get('/security/trend', authenticate, async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('risk_scores')
      .select('assessed_at, score, risk_level')
      .order('assessed_at', { ascending: false })
      .limit(100);
    if (error) throw error;
    res.json(data);
  } catch (err) { next(err); }
});

export default router;
