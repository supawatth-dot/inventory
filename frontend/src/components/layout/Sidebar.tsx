'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import clsx from 'clsx';

const nav = [
  { href: '/dashboard', label: 'Overview', icon: '📊' },
  { href: '/dashboard/employees', label: 'Employees', icon: '👥' },
  { href: '/dashboard/assets', label: 'Assets', icon: '💻' },
  { href: '/dashboard/tickets', label: 'Tickets', icon: '🎫' },
  { href: '/dashboard/security', label: 'Security', icon: '🔒' },
];

export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="w-64 min-h-screen bg-gray-900 text-white flex flex-col">
      <div className="px-6 py-5 border-b border-gray-700">
        <h1 className="text-lg font-bold text-white">IT-HR Platform</h1>
        <p className="text-xs text-gray-400 mt-1">Operational Intelligence</p>
      </div>
      <nav className="flex-1 px-4 py-4 space-y-1">
        {nav.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={clsx(
              'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
              pathname === item.href
                ? 'bg-blue-600 text-white'
                : 'text-gray-300 hover:bg-gray-800 hover:text-white'
            )}
          >
            <span>{item.icon}</span>
            {item.label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
