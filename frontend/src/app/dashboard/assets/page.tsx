'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Header } from '@/components/layout/Header';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Table, Thead, Tbody, Th, Td } from '@/components/ui/Table';

type Asset = {
  id: string;
  name: string;
  asset_type: string;
  serial_number: string;
  model: string;
  status: string;
  warranty_expiry: string;
};

const statusVariant: Record<string, 'success' | 'info' | 'warning' | 'danger' | 'default'> = {
  available: 'success',
  assigned: 'info',
  maintenance: 'warning',
  retired: 'danger',
};

export default function AssetsPage() {
  const [assets, setAssets] = useState<Asset[]>([]);

  useEffect(() => {
    api.get<Asset[]>('/assets').then(setAssets).catch(console.error);
  }, []);

  const isWarrantyExpiring = (date: string) => {
    if (!date) return false;
    const d = new Date(date);
    const threshold = new Date();
    threshold.setDate(threshold.getDate() + 30);
    return d <= threshold;
  };

  return (
    <div className="flex-1 overflow-y-auto">
      <Header title="IT Assets" />
      <main className="p-6">
        <Card>
          <Table>
            <Thead>
              <tr>
                <Th>Name</Th>
                <Th>Type</Th>
                <Th>Serial</Th>
                <Th>Model</Th>
                <Th>Status</Th>
                <Th>Warranty</Th>
              </tr>
            </Thead>
            <Tbody>
              {assets.map((a) => (
                <tr key={a.id}>
                  <Td className="font-medium">{a.name}</Td>
                  <Td className="capitalize">{a.asset_type}</Td>
                  <Td className="font-mono text-xs text-gray-500">{a.serial_number || '—'}</Td>
                  <Td>{a.model || '—'}</Td>
                  <Td>
                    <Badge variant={statusVariant[a.status] || 'default'}>{a.status}</Badge>
                  </Td>
                  <Td>
                    {a.warranty_expiry ? (
                      <span
                        className={
                          isWarrantyExpiring(a.warranty_expiry) ? 'text-red-600 font-medium' : ''
                        }
                      >
                        {new Date(a.warranty_expiry).toLocaleDateString()}
                        {isWarrantyExpiring(a.warranty_expiry) && ' ⚠️'}
                      </span>
                    ) : (
                      '—'
                    )}
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
