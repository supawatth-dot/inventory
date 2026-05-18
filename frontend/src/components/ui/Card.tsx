import { HTMLAttributes } from 'react';
import clsx from 'clsx';

export function Card({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div {...props} className={clsx('bg-white rounded-xl shadow-sm border border-gray-200', className)}>
      {children}
    </div>
  );
}

export function CardHeader({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div {...props} className={clsx('px-6 py-4 border-b border-gray-200', className)}>
      {children}
    </div>
  );
}

export function CardContent({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div {...props} className={clsx('px-6 py-4', className)}>
      {children}
    </div>
  );
}
