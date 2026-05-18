'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Card, CardHeader, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Table, Thead, Tbody, Th, Td } from '@/components/ui/Table';

type Ticket = {
  id: string;
  ticket_number: string;
  title: string;
  priority: string;
  status: string;
  created_at: string;
};

const priorityVariant: Record<string, 'danger' | 'warning' | 'info' | 'default'> = {
  critical: 'danger',
  high: 'warning',
  medium: 'info',
  low: 'default',
};

export function RecentTickets() {
  const [tickets, setTickets] = useState<Ticket[]>([]);

  useEffect(() => {
    api.get<Ticket[]>('/tickets?limit=5').then(setTickets).catch(console.error);
  }, []);

  return (
    <Card>
      <CardHeader>
        <h3 className="font-semibold text-gray-800">Recent Tickets</h3>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <Thead>
            <tr>
              <Th>Ticket</Th>
              <Th>Title</Th>
              <Th>Priority</Th>
              <Th>Status</Th>
            </tr>
          </Thead>
          <Tbody>
            {tickets.map((t) => (
              <tr key={t.id}>
                <Td className="font-mono text-xs">{t.ticket_number}</Td>
                <Td>{t.title}</Td>
                <Td>
                  <Badge variant={priorityVariant[t.priority] || 'default'}>{t.priority}</Badge>
                </Td>
                <Td>
                  <Badge>{t.status}</Badge>
                </Td>
              </tr>
            ))}
          </Tbody>
        </Table>
      </CardContent>
    </Card>
  );
}
