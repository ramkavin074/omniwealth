'use client';

interface Props {
  label: string;
}

export default function LowStockBadge({ label }: Props) {
  return (
    <span className="inline-flex items-center rounded-full bg-amber-100 dark:bg-amber-900/50 px-2 py-0.5 text-xs font-semibold text-amber-800 dark:text-amber-200">
      {label}
    </span>
  );
}
