import { createContext, useContext, type ReactNode } from 'react';
import type { InspectionPhotoCache, InspectionPhotoRef, InspectionPhotoRefOrStub } from '@sitescop/room-engine-core';

const InspectionPhotoCacheContext = createContext<InspectionPhotoCache | null>(null);

export function InspectionPhotoCacheProvider({
  cache,
  children,
}: {
  cache: InspectionPhotoCache;
  children: ReactNode;
}) {
  return <InspectionPhotoCacheContext.Provider value={cache}>{children}</InspectionPhotoCacheContext.Provider>;
}

export function useInspectionPhotoCache(): InspectionPhotoCache | null {
  return useContext(InspectionPhotoCacheContext);
}

export function useHydratedPhotos(photos: InspectionPhotoRefOrStub[] | undefined | null): InspectionPhotoRef[] {
  const cache = useInspectionPhotoCache();
  if (!photos?.length) return [];
  if (!cache) return photos as InspectionPhotoRef[];
  return cache.resolveArray(photos);
}
