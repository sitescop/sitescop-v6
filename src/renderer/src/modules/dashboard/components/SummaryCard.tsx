import { cn } from '@/lib/cn';

interface SummaryCardProps {
  label: string;
  value: number;
  accent: 'green' | 'blue' | 'amber' | 'purple' | 'red' | 'teal';
  onClick?: () => void;
}

const accentStyles = {
  green: 'from-primary/15 to-primary/5 border-primary/20 text-primary',
  blue: 'from-secondary/15 to-secondary/5 border-secondary/20 text-secondary',
  amber: 'from-accent/20 to-accent/5 border-accent/30 text-amber-800',
  purple: 'from-violet-100 to-violet-50 border-violet-200 text-violet-800',
  red: 'from-red-100 to-red-50 border-red-200 text-danger',
  teal: 'from-teal-100 to-teal-50 border-teal-200 text-teal-800',
};

export function SummaryCard({ label, value, accent, onClick }: SummaryCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-lg border bg-gradient-to-br p-5 text-left shadow-card transition-transform',
        onClick ? 'hover:scale-[1.02] active:scale-[0.99]' : 'cursor-default',
        accentStyles[accent],
      )}
    >
      <p className="text-3xl font-extrabold tabular-nums">{value}</p>
      <p className="mt-1 text-sm font-semibold opacity-90">{label}</p>
    </button>
  );
}
