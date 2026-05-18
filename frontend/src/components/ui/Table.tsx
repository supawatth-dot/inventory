import { HTMLAttributes, ThHTMLAttributes, TdHTMLAttributes } from 'react';
import clsx from 'clsx';

export function Table({ className, children }: HTMLAttributes<HTMLTableElement>) {
  return (
    <div className="overflow-x-auto">
      <table className={clsx('min-w-full divide-y divide-gray-200', className)}>{children}</table>
    </div>
  );
}

export function Thead({ children }: HTMLAttributes<HTMLTableSectionElement>) {
  return <thead className="bg-gray-50">{children}</thead>;
}

export function Tbody({ children }: HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className="bg-white divide-y divide-gray-200">{children}</tbody>;
}

export function Th({ children, className }: ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className={clsx(
        'px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider',
        className
      )}
    >
      {children}
    </th>
  );
}

export function Td({ children, className }: TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td className={clsx('px-6 py-4 whitespace-nowrap text-sm text-gray-900', className)}>
      {children}
    </td>
  );
}
