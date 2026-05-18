'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Header } from '@/components/layout/Header';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Table, Thead, Tbody, Th, Td } from '@/components/ui/Table';

type Employee = {
  id: string;
  full_name: string;
  email: string;
  job_title: string;
  status: string;
  departments?: { name: string };
  hire_date: string;
};

const statusVariant: Record<string, 'success' | 'warning' | 'danger' | 'default'> = {
  active: 'success',
  offboarding: 'warning',
  inactive: 'danger',
};

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const q = search ? `?search=${encodeURIComponent(search)}` : '';
    api.get<Employee[]>(`/employees${q}`).then(setEmployees).catch(console.error);
  }, [search]);

  return (
    <div className="flex-1 overflow-y-auto">
      <Header title="Employees" />
      <main className="p-6 space-y-4">
        <div className="flex justify-between items-center">
          <input
            type="search"
            placeholder="Search employees…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-64"
          />
          <span className="text-sm text-gray-500">{employees.length} employees</span>
        </div>
        <Card>
          <Table>
            <Thead>
              <tr>
                <Th>Name</Th>
                <Th>Email</Th>
                <Th>Title</Th>
                <Th>Department</Th>
                <Th>Status</Th>
                <Th>Hire Date</Th>
              </tr>
            </Thead>
            <Tbody>
              {employees.map((e) => (
                <tr key={e.id}>
                  <Td className="font-medium">{e.full_name}</Td>
                  <Td className="text-gray-500">{e.email}</Td>
                  <Td>{e.job_title}</Td>
                  <Td>{e.departments?.name || '—'}</Td>
                  <Td>
                    <Badge variant={statusVariant[e.status] || 'default'}>{e.status}</Badge>
                  </Td>
                  <Td className="text-gray-500">{new Date(e.hire_date).toLocaleDateString()}</Td>
                </tr>
              ))}
            </Tbody>
          </Table>
        </Card>
      </main>
    </div>
  );
}
