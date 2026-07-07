import type { JobRow } from '@shared/api-types';

export function filterJobsBySearch(jobs: JobRow[], query: string): JobRow[] {
  const term = query.trim().toLowerCase();
  if (!term) return jobs;

  return jobs.filter((job) => {
    const haystack = [
      job.jobNumber,
      job.clientName,
      job.propertyAddress,
      job.email,
      job.mobile,
      job.agentName,
      job.realEstate,
      job.notes,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    return haystack.includes(term);
  });
}
