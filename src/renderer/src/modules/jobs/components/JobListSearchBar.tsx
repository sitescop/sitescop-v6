import { Search } from 'lucide-react';
import { Input } from '@/design-system/components';

interface JobListSearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  resultCount?: number;
  totalCount?: number;
}

export function JobListSearchBar({
  value,
  onChange,
  placeholder = 'Search by job number, client, address, email…',
  resultCount,
  totalCount,
}: JobListSearchBarProps) {
  const showCount =
    typeof resultCount === 'number' &&
    typeof totalCount === 'number' &&
    value.trim() &&
    resultCount !== totalCount;

  return (
    <div className="mb-4">
      <div className="relative max-w-xl">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
        <Input
          className="pl-9"
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-label="Search jobs"
        />
      </div>
      {showCount && (
        <p className="mt-2 text-xs text-text-muted">
          Showing {resultCount} of {totalCount} jobs
        </p>
      )}
      {value.trim() && resultCount === 0 && (
        <p className="mt-2 text-sm text-text-light">No jobs match your search.</p>
      )}
    </div>
  );
}
