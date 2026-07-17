import { createContext, useContext } from 'react';

/** When set, only the matching accordion section id is rendered (workspace v2). */
export const WorkspaceSectionFilterContext = createContext<string | null>(null);

export function useWorkspaceSectionFilter(): string | null {
  return useContext(WorkspaceSectionFilterContext);
}
