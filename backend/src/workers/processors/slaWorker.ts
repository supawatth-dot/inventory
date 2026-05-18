import { Job } from 'bullmq';
import { supabase } from '../../lib/supabase';
import { notify } from '../../lib/webhooks';
import { sendEmail } from '../../lib/mailer';

export async function processSLACheck(_job: Job) {
  const { data: overdue } = await supabase
    .from('tickets')
    .select('*, assignee:employees!assignee_id(full_name, email)')
    .lt('sla_due_at', new Date().toISOString())
    .not('status', 'in', '("resolved","closed")');

  if (!overdue?.length) return { overdue: 0 };

  for (const ticket of overdue) {
    const assignee = ticket.assignee as { full_name: string; email: string } | null;
    await notify(
      'SLA Breach Alert',
      `Ticket ${ticket.ticket_number} (${ticket.priority}) "${ticket.title}" is overdue. Assigned to: ${assignee?.full_name || 'Unassigned'}.`
    );
    if (assignee?.email) {
      await sendEmail(
        assignee.email,
        `SLA Breach: ${ticket.ticket_number}`,
        `<p>Ticket <strong>${ticket.ticket_number}</strong> "${ticket.title}" has breached its SLA. Please resolve immediately.</p>`
      );
    }
  }

  return { overdue: overdue.length };
}
