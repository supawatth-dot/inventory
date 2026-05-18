'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Header } from '@/components/layout/Header';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Table, Thead, Tbody, Th, Td } from '@/components/ui/Table';

type Ticket = {
  id: string;
  ticket_number: string;
  title: string;
  priority: string;
  status: string;
  sla_due_at: string;
  assignee?: { full_name: string };
};

const priorityVariant: Record<string, 'danger' | 'warning' | 'info' | 'default'> = {
  critical: 'danger',
  high: 'warning',
  medium: 'info',
  low: 'default',
};

const statusVariant: Record<string, 'success' | 'info' | 'warning' | 'danger' | 'default'> = {
  resolved: 'success',
  in_progress: 'info',
  pending: 'warning',
  closed: 'default',
  open: 'danger',
};

export default function TicketsPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [filter, setFilter] = useState('');

  useEffect(() => {
    const q = filter ? `?status=${filter}` : '';
    api.get<Ticket[]>(`/tickets${q}`).then(setTickets).catch(console.error);
  }, [filter]);

  const isSLABreached = (due: string) => due && new Date(due) < new Date();

  return (
    <div className="flex-1 overflow-y-auto">
      <Header title="Support Tickets" />
      <main className="p-6 space-y-4">
        <div className="flex gap-2">
          {['', 'open', 'in_progress', 'pending', 'resolved'].map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                filter === s
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {s || 'All'}
            </button>
          ))}
        </div>
        <Card>
          <Table>
            <Thead>
              <tr>
                <Th>Number</Th>
                <Th>Title</Th>
                <Th>Priority</Th>
                <Th>Status</Th>
                <Th>Assignee</Th>
                <Th>SLA Due</Th>
              </tr>
            </Thead>
            <Tbody>
              {tickets.map((t) => (
                <tr key={t.id}>
                  <Td className="font-mono text-xs">{t.ticket_number}</Td>
                  <Td className="max-w-xs truncate">{t.title}</Td>
                  <Td>
                    <Badge variant={priorityVariant[t.priority] || 'default'}>{t.priority}</Badge>
                  </Td>
                  <Td>
                    <Badge variant={statusVariant[t.status] || 'default'}>{t.status}</Badge>
                  </Td>
                  <Td>
                    {t.assignee?.full_name || (
                      <span className="text-gray-400">Unassigned</span>
                    )}
                  </Td>
                  <Td
                    className={
                      isSLABreached(t.sla_due_at) ? 'text-red-600 font-medium' : 'text-gray-500'
                    }
                  >
                    {t.sla_due_at ? new Date(t.sla_due_at).toLocaleString() : '—'}
                    {isSLABreached(t.sla_due_at) && ' ⚠️'}
                  </Td>
                </tr>
              ))}
            </Tbody>
          </Table>
        </Card>
      </main>
    </div>
  );
}
