import { supabase } from '../lib/supabase';
import { notify } from '../lib/webhooks';

export function startRealtimeSubscriptions() {
  // New critical tickets
  supabase
    .channel('tickets-realtime')
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'tickets', filter: 'priority=eq.critical' },
      async (payload) => {
        const ticket = payload.new as { ticket_number: string; title: string };
        await notify('New Critical Ticket', `${ticket.ticket_number}: ${ticket.title}`);
      }
    )
    .subscribe();

  // Employee status changes
  supabase
    .channel('employees-realtime')
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'employees' },
      async (payload) => {
        const emp = payload.new as { full_name: string; status: string };
        if (emp.status === 'offboarding') {
          await notify(
            'Offboarding Alert',
            `${emp.full_name} has started offboarding. Please initiate IT access revocation.`
          );
        }
      }
    )
    .subscribe();

  console.log('Realtime subscriptions active');
}
