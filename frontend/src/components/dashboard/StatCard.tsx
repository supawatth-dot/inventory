import { Card, CardContent } from '@/components/ui/Card';
import clsx from 'clsx';

interface StatCardProps {
  label: string;
  value: number | string;
  subtext?: string;
  color?: 'blue' | 'green' | 'yellow' | 'red';
  icon?: string;
}

const colors = {
  blue: 'text-blue-600 bg-blue-50',
  green: 'text-green-600 bg-green-50',
  yellow: 'text-yellow-600 bg-yellow-50',
  red: 'text-red-600 bg-red-50',
};

export function StatCard({ label, value, subtext, color = 'blue', icon }: StatCardProps) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 py-5">
        {icon && (
          <div
            className={clsx(
              'w-12 h-12 rounded-lg flex items-center justify-center text-2xl',
              colors[color]
            )}
          >
            {icon}
          </div>
        )}
        <div>
          <p className="text-sm text-gray-500">{label}</p>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
          {subtext && <p className="text-xs text-gray-400 mt-0.5">{subtext}</p>}
        </div>
      </CardContent>
    </Card>
  );
}
