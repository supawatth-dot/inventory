'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Header } from '@/components/layout/Header';
import { StatCard } from '@/components/dashboard/StatCard';
import { RecentTickets } from '@/components/dashboard/RecentTickets';

interface Summary {
  employees: { total: number; active: number };
  tickets: { open: number; critical: number; sla_overdue: number };
  assets: { total: number; available: number };
  security: { risk_distribution: Record<string, number> };
}

export default function DashboardPage() {
  const [summary, setSummary] = useState<Summary | null>(null);

  useEffect(() => {
    api.get<Summary>('/dashboard/summary').then(setSummary).catch(console.error);
  }, []);

  return (
    <div className="flex-1 overflow-y-auto">
      <Header title="Executive Dashboard" />
      <main className="p-6 space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="Active Employees"
            value={summary?.employees.active ?? '…'}
            subtext={`${summary?.employees.total ?? 0} total`}
            color="blue"
            icon="👥"
          />
          <StatCard
            label="Open Tickets"
            value={summary?.tickets.open ?? '…'}
            subtext={`${summary?.tickets.critical ?? 0} critical`}
            color="yellow"
            icon="🎫"
          />
          <StatCard
            label="SLA Breached"
            value={summary?.tickets.sla_overdue ?? '…'}
            color="red"
            icon="⚠️"
          />
          <StatCard
            label="Available Assets"
            value={summary?.assets.available ?? '…'}
            subtext={`${summary?.assets.total ?? 0} total`}
            color="green"
            icon="💻"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="font-semibold text-gray-800 mb-4">Security Risk Distribution</h3>
            {summary?.security.risk_distribution ? (
              Object.entries(summary.security.risk_distribution).map(([level, count]) => (
                <div
                  key={level}
                  className="flex justify-between items-center py-1.5 border-b border-gray-100 last:border-0"
                >
                  <span className="text-sm capitalize text-gray-600">{level}</span>
                  <span className="text-sm font-semibold text-gray-900">{count}</span>
                </div>
              ))
            ) : (
              <p className="text-sm text-gray-400">No risk data</p>
            )}
          </div>
          <div className="lg:col-span-2">
            <RecentTickets />
          </div>
        </div>
      </main>
    </div>
  );
}
