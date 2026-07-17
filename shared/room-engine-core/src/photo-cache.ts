import type { InspectionPhotoRef } from './types.js';

export type InspectionPhotoStub = Pick<InspectionPhotoRef, 'id' | 'createdAt' | 'caption'>;

export type InspectionPhotoRefOrStub = InspectionPhotoRef | InspectionPhotoStub;

function isPhotoRef(value: unknown): value is InspectionPhotoRef {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    typeof (value as InspectionPhotoRef).id === 'string' &&
    'createdAt' in value
  );
}

function isPhotoArray(value: unknown): value is InspectionPhotoRef[] {
  return Array.isArray(value) && value.every(isPhotoRef);
}

function isPhotoArrayKey(key: string): boolean {
  return key === 'photos' || key.endsWith('Photos');
}

function hasPhotoPayload(photo: InspectionPhotoRefOrStub): photo is InspectionPhotoRef {
  return typeof (photo as InspectionPhotoRef).dataUrl === 'string' && (photo as InspectionPhotoRef).dataUrl.length > 0;
}

function toStub(photo: InspectionPhotoRef): InspectionPhotoStub {
  return {
    id: photo.id,
    createdAt: photo.createdAt,
    caption: photo.caption,
  };
}

export class InspectionPhotoCache {
  private readonly byId = new Map<string, InspectionPhotoRef>();

  clear(): void {
    this.byId.clear();
  }

  set(photo: InspectionPhotoRef): void {
    this.byId.set(photo.id, photo);
  }

  setMany(photos: InspectionPhotoRef[]): void {
    for (const photo of photos) {
      this.set(photo);
    }
  }

  get(id: string): InspectionPhotoRef | undefined {
    return this.byId.get(id);
  }

  resolve(photo: InspectionPhotoRefOrStub): InspectionPhotoRef {
    if (hasPhotoPayload(photo)) return photo;
    const cached = this.byId.get(photo.id);
    if (cached) return cached;
    return { ...photo, dataUrl: '' };
  }

  resolveArray(photos: InspectionPhotoRefOrStub[] | undefined | null): InspectionPhotoRef[] {
    if (!photos?.length) return [];
    return photos.map((photo) => this.resolve(photo));
  }
}

function walkPhotoArrays(value: unknown, visit: (photos: InspectionPhotoRef[]) => void): void {
  if (Array.isArray(value)) {
    for (const item of value) walkPhotoArrays(item, visit);
    return;
  }
  if (!value || typeof value !== 'object') return;

  for (const [key, entry] of Object.entries(value)) {
    if (isPhotoArrayKey(key) && isPhotoArray(entry)) {
      visit(entry);
    } else {
      walkPhotoArrays(entry, visit);
    }
  }
}

/** Store any full photo payloads in the cache. */
export function collectPhotosIntoCache(value: unknown, cache: InspectionPhotoCache): void {
  walkPhotoArrays(value, (photos) => {
    for (const photo of photos) {
      if (hasPhotoPayload(photo)) {
        cache.set(photo);
      }
    }
  });
}

function stripWalk(value: unknown, cache: InspectionPhotoCache): unknown {
  if (Array.isArray(value)) {
    if (isPhotoArray(value)) {
      return value.map((photo) => {
        if (hasPhotoPayload(photo)) cache.set(photo);
        return toStub(photo);
      });
    }
    return value.map((item) => stripWalk(item, cache));
  }
  if (!value || typeof value !== 'object') return value;

  const out: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (isPhotoArrayKey(key) && isPhotoArray(entry)) {
      out[key] = entry.map((photo) => {
        if (hasPhotoPayload(photo)) cache.set(photo);
        return toStub(photo);
      });
    } else {
      out[key] = stripWalk(entry, cache);
    }
  }
  return out;
}

function hydrateWalk(value: unknown, cache: InspectionPhotoCache): unknown {
  if (Array.isArray(value)) {
    if (value.length > 0 && value.every(isPhotoRef)) {
      return (value as InspectionPhotoRefOrStub[]).map((photo) => cache.resolve(photo));
    }
    return value.map((item) => hydrateWalk(item, cache));
  }
  if (!value || typeof value !== 'object') return value;

  const out: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (isPhotoArrayKey(key) && Array.isArray(entry) && entry.every(isPhotoRef)) {
      out[key] = (entry as InspectionPhotoRefOrStub[]).map((photo) => cache.resolve(photo));
    } else {
      out[key] = hydrateWalk(entry, cache);
    }
  }
  return out;
}

export function stripPhotosFromValue<T>(value: T, cache: InspectionPhotoCache): T {
  return stripWalk(value, cache) as T;
}

export function hydratePhotosInValue<T>(value: T, cache: InspectionPhotoCache): T {
  return hydrateWalk(value, cache) as T;
}
