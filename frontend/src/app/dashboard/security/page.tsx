'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Header } from '@/components/layout/Header';
import { Card, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Table, Thead, Tbody, Th, Td } from '@/components/ui/Table';

type RiskScore = {
  id: string;
  score: number;
  risk_level: string;
  assessed_at: string;
  employee?: { full_name: string; email: string };
};

const riskVariant: Record<string, 'success' | 'warning' | 'danger' | 'default'> = {
  low: 'success',
  medium: 'warning',
  high: 'danger',
  critical: 'danger',
};

export default function SecurityPage() {
  const [scores, setScores] = useState<RiskScore[]>([]);

  useEffect(() => {
    api.get<RiskScore[]>('/security/risk-scores').then(setScores).catch(console.error);
  }, []);

  const avgScore = scores.length
    ? Math.round(scores.reduce((a, s) => a + s.score, 0) / scores.length)
    : null;

  return (
    <div className="flex-1 overflow-y-auto">
      <Header title="Security & Risk" />
      <main className="p-6 space-y-6">
        <div className="grid grid-cols-3 gap-4">
          <Card>
            <CardContent className="py-5 text-center">
              <p className="text-sm text-gray-500">Avg Risk Score</p>
              <p className="text-3xl font-bold text-gray-900">
                {avgScore ?? '—'}
                <span className="text-lg text-gray-400">/100</span>
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-5 text-center">
              <p className="text-sm text-gray-500">High Risk Employees</p>
              <p className="text-3xl font-bold text-red-600">
                {scores.filter((s) => s.risk_level === 'high' || s.risk_level === 'critical').length}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-5 text-center">
              <p className="text-sm text-gray-500">Low Risk Employees</p>
              <p className="text-3xl font-bold text-green-600">
                {scores.filter((s) => s.risk_level === 'low').length}
              </p>
            </CardContent>
          </Card>
        </div>
        <Card>
          <Table>
            <Thead>
              <tr>
                <Th>Employee</Th>
                <Th>Email</Th>
                <Th>Score</Th>
                <Th>Risk Level</Th>
                <Th>Assessed</Th>
              </tr>
            </Thead>
            <Tbody>
              {scores.map((s) => (
                <tr key={s.id}>
                  <Td className="font-medium">{s.employee?.full_name || '—'}</Td>
                  <Td className="text-gray-500">{s.employee?.email || '—'}</Td>
                  <Td>
                    <div className="flex items-center gap-2">
                      <div className="w-20 h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            s.score >= 80
                              ? 'bg-green-500'
                              : s.score >= 60
                              ? 'bg-yellow-500'
                              : 'bg-red-500'
                          }`}
                          style={{ width: `${s.score}%` }}
                        />
                      </div>
                      <span className="text-sm font-medium">{s.score}</span>
                    </div>
                  </Td>
                  <Td>
                    <Badge variant={riskVariant[s.risk_level] || 'default'}>{s.risk_level}</Badge>
                  </Td>
                  <Td className="text-gray-500">{new Date(s.assessed_at).toLocaleDateString()}</Td>
                </tr>
              ))}
            </Tbody>
          </Table>
        </Card>
      </main>
    </div>
  );
}
