'use client';
import { signOut } from '@/lib/auth';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';

export function Header({ title }: { title: string }) {
  const router = useRouter();
  const handleSignOut = async () => {
    await signOut();
    router.push('/login');
  };
  return (
    <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6">
      <h2 className="text-lg font-semibold text-gray-800">{title}</h2>
      <div className="flex items-center gap-3">
        <span className="text-sm text-gray-500">{new Date().toLocaleDateString()}</span>
        <Button variant="ghost" size="sm" onClick={handleSignOut}>
          Sign Out
        </Button>
      </div>
    </header>
  );
}
