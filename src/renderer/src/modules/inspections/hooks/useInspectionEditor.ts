import { useCallback, useEffect, useRef, useState, startTransition } from 'react';
import type { InspectionFormDataV2, InspectionFormRealm, MajorDefectRollupRoom } from '@sitescop/room-engine-core';
import {
  enrichInspectionFormData,
  enrichInspectionFormDataForSection,
  getSectionData,
  jobTypeToFormKind,
  mergeRoomDataForReport,
  normalizeInspectionFormData,
  patchSectionData,
  InspectionPhotoCache,
  collectPhotosIntoCache,
  stripPhotosFromValue,
  hydratePhotosInValue,
} from '@sitescop/room-engine-core';
import type { InspectionDetail, InspectionRoomDetail } from '@shared/inspection-types';
import { getSitescopApi } from '@/lib/sitescop-api';

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

const SAVE_DEBOUNCE_MS = 30_000;
const PHOTO_SAVE_DEBOUNCE_MS = 30_000;
const ROOM_ENRICH_DEBOUNCE_MS = 400;

const AUTO_SYNC_KEYS = new Set([
  'shared:accessibilityObstructions',
  'shared:inspectorHazardAssessment',
  'building:conclusion',
  'building:recommendations',
]);

/** Sections that need live cross-field sync in the UI (others enrich on save). */
const LIVE_ENRICH_SECTION_KEYS = new Set([
  'shared:services',
  'shared:accessibilityObstructions',
  'shared:propertyDescription',
  'shared:inspectorHazardAssessment',
  'building:majorDefects',
  'building:conclusion',
  'building:recommendations',
  'building:subfloor',
]);

const LIVE_PEST_ENRICH_SECTION_KEYS = new Set([
  'undetectedTimberPestRisk',
  'd1ActiveTermites',
  'd2ManagementProposal',
  'd3TermiteWorkings',
  'd4PreviousTreatment',
  'd10ExcessiveMoisture',
  'd11BarrierBridging',
  'd12UntreatedTimber',
  'd13ConduciveConditions',
  'd14MajorSafetyHazards',
  'pestConclusion',
]);

const ROOM_ENRICH_FIELD_KEYS = new Set([
  'comments',
  'photos',
  'defects',
  'damageObserved',
  'cracking',
  'crackingEntries',
  'moistureDamage',
  'moistureLevel',
  'waterPooling',
  'waterPoolingPhotos',
  'leakInsideCabinet',
  'activeLeak',
  'leakage',
  'floorWaste',
  'drainage',
  'evidenceLocations',
  'finishElementDamageEntries',
  'noMajorDefectObserved',
  'majorDefectObserved',
]);

function sectionTimerKey(realm: InspectionFormRealm, section: string): string {
  return `${realm}:${section}`;
}

function sectionNeedsLiveEnrich(realm: InspectionFormRealm, section: string): boolean {
  if (realm === 'pest') return LIVE_PEST_ENRICH_SECTION_KEYS.has(section);
  return LIVE_ENRICH_SECTION_KEYS.has(sectionTimerKey(realm, section));
}

function roomUpdateNeedsEnrich(partial: Record<string, unknown>): boolean {
  return Object.keys(partial).some(
    (key) =>
      ROOM_ENRICH_FIELD_KEYS.has(key) ||
      key.toLowerCase().includes('damage') ||
      key.toLowerCase().includes('moisture') ||
      key.toLowerCase().includes('crack') ||
      key.toLowerCase().includes('defect') ||
      key.toLowerCase().includes('leak'),
  );
}

function roomDataNeedsEnrich(previous: Record<string, unknown>, next: Record<string, unknown>): boolean {
  return Object.keys(next).some((key) => previous[key] !== next[key] && roomUpdateNeedsEnrich({ [key]: next[key] }));
}

function enrichRooms(rooms: InspectionRoomDetail[]): InspectionRoomDetail[] {
  return rooms.map((room) => ({
    ...room,
    data: mergeRoomDataForReport(room.roomType, room.roomIndex, room.data),
  }));
}

function enrichForm(
  form: InspectionFormDataV2,
  rooms: InspectionRoomDetail[],
  preserveAccessibilityPhotos = false,
): InspectionFormDataV2 {
  return enrichInspectionFormData(form, {
    rooms: roomsForEnrichment(rooms),
    preserveAccessibilityPhotos,
  });
}

function roomsForEnrichment(rooms: InspectionRoomDetail[]): MajorDefectRollupRoom[] {
  return rooms.map((room) => ({
    id: room.id,
    label: room.label,
    roomType: room.roomType,
    data: room.data,
  }));
}

function parseSectionTimerKey(timerKey: string): { realm: InspectionFormRealm; section: string } | null {
  const colon = timerKey.indexOf(':');
  if (colon <= 0) return null;
  return {
    realm: timerKey.slice(0, colon) as InspectionFormRealm,
    section: timerKey.slice(colon + 1),
  };
}

function saveDebounceMs(partial: Record<string, unknown>): number {
  // Keep the 30s roll for photos too — immediate saves on every photo tweak freeze the UI.
  if (Object.prototype.hasOwnProperty.call(partial, 'photos')) return PHOTO_SAVE_DEBOUNCE_MS;
  if (Object.keys(partial).some((key) => key.endsWith('Photos'))) return PHOTO_SAVE_DEBOUNCE_MS;
  // Quick-action Major / No Major must persist immediately so PDF matches the click.
  if (
    Object.prototype.hasOwnProperty.call(partial, 'noMajorDefectObserved') ||
    Object.prototype.hasOwnProperty.call(partial, 'majorDefectObserved')
  ) {
    return 0;
  }
  return SAVE_DEBOUNCE_MS;
}

function hasDefectQuickFlag(partial: Record<string, unknown>): boolean {
  return (
    Object.prototype.hasOwnProperty.call(partial, 'noMajorDefectObserved') ||
    Object.prototype.hasOwnProperty.call(partial, 'majorDefectObserved')
  );
}

function bumpSectionGeneration(generations: Map<string, number>, timerKey: string): number {
  const next = (generations.get(timerKey) ?? 0) + 1;
  generations.set(timerKey, next);
  return next;
}

export function useInspectionEditor(
  inspection: InspectionDetail | undefined,
  inspectionId: string | undefined,
  readOnly: boolean,
) {
  const [formData, setFormData] = useState<InspectionFormDataV2 | null>(null);
  const [rooms, setRooms] = useState<InspectionRoomDetail[]>([]);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const sectionTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const roomTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const roomEnrichTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sectionSaveGeneration = useRef<Map<string, number>>(new Map());
  const sectionSaveChains = useRef<Map<string, Promise<void>>>(new Map());
  const roomSaveGeneration = useRef<Map<string, number>>(new Map());
  const roomSaveChains = useRef<Map<string, Promise<void>>>(new Map());
  const formDataRef = useRef<InspectionFormDataV2 | null>(null);
  const roomsRef = useRef<InspectionRoomDetail[]>([]);
  const loadedInspectionIdRef = useRef<string | undefined>(undefined);
  const inspectionIdRef = useRef(inspectionId);
  const readOnlyRef = useRef(readOnly);
  const activeSaveCountRef = useRef(0);
  const photoCacheRef = useRef(new InspectionPhotoCache());

  const toLiteForm = useCallback((form: InspectionFormDataV2): InspectionFormDataV2 => {
    collectPhotosIntoCache(form, photoCacheRef.current);
    return stripPhotosFromValue(form, photoCacheRef.current);
  }, []);

  const toLiteRooms = useCallback((nextRooms: InspectionRoomDetail[]): InspectionRoomDetail[] => {
    return nextRooms.map((room) => {
      collectPhotosIntoCache(room.data, photoCacheRef.current);
      return { ...room, data: stripPhotosFromValue(room.data, photoCacheRef.current) };
    });
  }, []);

  const scheduleRoomFormEnrich = useCallback(() => {
    if (roomEnrichTimer.current) clearTimeout(roomEnrichTimer.current);
    roomEnrichTimer.current = setTimeout(() => {
      roomEnrichTimer.current = null;
      setFormData((current) => {
        if (!current?.building) return current;
        const enriched = enrichInspectionFormDataForSection(current, 'building', 'majorDefects', {
          rooms: roomsForEnrichment(roomsRef.current),
        });
        const lite = toLiteForm(enriched);
        formDataRef.current = lite;
        return lite;
      });
    }, ROOM_ENRICH_DEBOUNCE_MS);
  }, [toLiteForm]);
  inspectionIdRef.current = inspectionId;
  readOnlyRef.current = readOnly;

  const flashSaved = useCallback(() => {
    setSaveState('saved');
    setTimeout(() => setSaveState('idle'), 1500);
  }, []);

  const applyServerSectionSync = useCallback(
    (
      prev: InspectionFormDataV2,
      realm: InspectionFormRealm,
      section: string,
      server: InspectionFormDataV2,
    ): InspectionFormDataV2 => {
      const syncKey = sectionTimerKey(realm, section);
      const next = { ...prev };
      if (AUTO_SYNC_KEYS.has(syncKey)) {
        if (realm === 'shared') {
          next.shared = {
            ...prev.shared,
            [section]: server.shared[section as keyof typeof server.shared],
          };
        } else if (realm === 'building' && prev.building) {
          next.building = {
            ...prev.building,
            [section]: server.building![section as keyof NonNullable<typeof server.building>],
          };
        }
      }
      if (realm === 'pest' && server.pest) {
        next.pest = server.pest;
      }
      if (realm === 'shared' && section === 'accessibilityObstructions' && server.pest && prev.pest) {
        next.pest = server.pest;
      }
      return next;
    },
    [],
  );

  const persistSection = useCallback(
    async (realm: InspectionFormRealm, section: string, expectedGeneration: number) => {
      const timerKey = sectionTimerKey(realm, section);
      if (sectionSaveGeneration.current.get(timerKey) !== expectedGeneration) return;

      const currentInspectionId = inspectionIdRef.current;
      if (readOnlyRef.current || !currentInspectionId) return;

      const current = formDataRef.current;
      if (!current) return;

      const sectionData = getSectionData(current, realm, section);
      if (!sectionData) return;

      const payload = hydratePhotosInValue(sectionData, photoCacheRef.current) as Record<string, unknown>;
      if (Array.isArray(payload.photos)) {
        payload.photos = payload.photos.filter(
          (photo) =>
            photo &&
            typeof photo === 'object' &&
            typeof (photo as { dataUrl?: string }).dataUrl === 'string' &&
            (photo as { dataUrl: string }).dataUrl.length > 20,
        );
      }

      activeSaveCountRef.current += 1;
      setSaveState('saving');
      try {
        if (sectionSaveGeneration.current.get(timerKey) !== expectedGeneration) return;

        const result = await getSitescopApi().inspections.updateSection(currentInspectionId, {
          realm,
          section,
          data: payload,
        });

        if (sectionSaveGeneration.current.get(timerKey) !== expectedGeneration) return;

        if (realm === 'shared' && section === 'propertyDescription') {
          const normalizedRooms = toLiteRooms(enrichRooms(result.inspection.rooms));
          setRooms(normalizedRooms);
          roomsRef.current = normalizedRooms;
        }

        const syncKey = sectionTimerKey(realm, section);
        if (AUTO_SYNC_KEYS.has(syncKey) || realm === 'pest') {
          setFormData((prev) => {
            if (!prev) return prev;
            if (sectionSaveGeneration.current.get(timerKey) !== expectedGeneration) return prev;
            const synced = applyServerSectionSync(prev, realm, section, result.inspection.formData);
            const next = toLiteForm(synced);
            formDataRef.current = next;
            return next;
          });
        }

        flashSaved();
      } catch {
        if (sectionSaveGeneration.current.get(timerKey) === expectedGeneration) {
          setSaveState('error');
          setTimeout(() => setSaveState('idle'), 3000);
        }
      } finally {
        activeSaveCountRef.current = Math.max(0, activeSaveCountRef.current - 1);
      }
    },
    [applyServerSectionSync, flashSaved, toLiteForm, toLiteRooms],
  );

  const enqueueSectionSave = useCallback(
    (realm: InspectionFormRealm, section: string, expectedGeneration: number) => {
      const timerKey = sectionTimerKey(realm, section);
      const run = () => {
        sectionTimers.current.delete(timerKey);
        const chained = (sectionSaveChains.current.get(timerKey) ?? Promise.resolve()).then(() =>
          persistSection(realm, section, expectedGeneration),
        );
        sectionSaveChains.current.set(timerKey, chained);
        void chained;
      };
      run();
    },
    [persistSection],
  );

  const persistRoom = useCallback(
    async (roomId: string, expectedGeneration: number) => {
      if (roomSaveGeneration.current.get(roomId) !== expectedGeneration) return;

      const currentInspectionId = inspectionIdRef.current;
      if (readOnlyRef.current || !currentInspectionId) return;

      const room = roomsRef.current.find((entry) => entry.id === roomId);
      if (!room) return;

      const payload = hydratePhotosInValue(room.data, photoCacheRef.current) as Record<string, unknown>;
      // Drop photo stubs that failed to hydrate so PDF never gets empty image slots.
      if (Array.isArray(payload.photos)) {
        payload.photos = payload.photos.filter(
          (photo) =>
            photo &&
            typeof photo === 'object' &&
            typeof (photo as { dataUrl?: string }).dataUrl === 'string' &&
            (photo as { dataUrl: string }).dataUrl.length > 20,
        );
      }

      activeSaveCountRef.current += 1;
      setSaveState('saving');
      try {
        if (roomSaveGeneration.current.get(roomId) !== expectedGeneration) return;
        await getSitescopApi().inspections.updateRoom(currentInspectionId, roomId, { data: payload });
        if (roomSaveGeneration.current.get(roomId) !== expectedGeneration) return;
        flashSaved();
      } catch {
        if (roomSaveGeneration.current.get(roomId) === expectedGeneration) {
          setSaveState('error');
          setTimeout(() => setSaveState('idle'), 3000);
        }
      } finally {
        activeSaveCountRef.current = Math.max(0, activeSaveCountRef.current - 1);
      }
    },
    [flashSaved],
  );

  const enqueueRoomSave = useCallback(
    (roomId: string, expectedGeneration: number) => {
      const run = () => {
        roomTimers.current.delete(roomId);
        const chained = (roomSaveChains.current.get(roomId) ?? Promise.resolve()).then(() =>
          persistRoom(roomId, expectedGeneration),
        );
        roomSaveChains.current.set(roomId, chained);
        void chained;
      };
      run();
    },
    [persistRoom],
  );

  const flushPendingSaves = useCallback(async () => {
    if (roomEnrichTimer.current) {
      clearTimeout(roomEnrichTimer.current);
      roomEnrichTimer.current = null;
      const current = formDataRef.current;
      if (current?.building) {
        const enriched = enrichInspectionFormDataForSection(current, 'building', 'majorDefects', {
          rooms: roomsForEnrichment(roomsRef.current),
        });
        const lite = toLiteForm(enriched);
        formDataRef.current = lite;
        setFormData(lite);
      }
    }

    const sectionFlushes: Promise<void>[] = [];
    for (const [timerKey, timer] of [...sectionTimers.current.entries()]) {
      clearTimeout(timer);
      sectionTimers.current.delete(timerKey);
      const parsed = parseSectionTimerKey(timerKey);
      if (parsed) {
        const generation = bumpSectionGeneration(sectionSaveGeneration.current, timerKey);
        enqueueSectionSave(parsed.realm, parsed.section, generation);
        const chained = sectionSaveChains.current.get(timerKey);
        if (chained) sectionFlushes.push(chained);
      }
    }

    const roomFlushes: Promise<void>[] = [];
    for (const [roomId, timer] of [...roomTimers.current.entries()]) {
      clearTimeout(timer);
      roomTimers.current.delete(roomId);
      const generation = bumpSectionGeneration(roomSaveGeneration.current, roomId);
      enqueueRoomSave(roomId, generation);
    }
    for (const chained of roomSaveChains.current.values()) {
      roomFlushes.push(chained);
    }
    for (const chained of sectionSaveChains.current.values()) {
      if (!sectionFlushes.includes(chained)) sectionFlushes.push(chained);
    }

    await Promise.all([...sectionFlushes, ...roomFlushes]);
  }, [enqueueRoomSave, enqueueSectionSave, toLiteForm]);

  useEffect(() => {
    if (!inspection) {
      loadedInspectionIdRef.current = undefined;
      return;
    }
    // Only hydrate when opening a different inspection. Refetch/focus updates of the
    // same job must not clobber in-progress Major / No Major clicks with stale server data.
    if (loadedInspectionIdRef.current === inspection.id && formDataRef.current) {
      return;
    }
    loadedInspectionIdRef.current = inspection.id;
    try {
      const formKind = jobTypeToFormKind(inspection.jobType);
      const normalizedRooms = enrichRooms(inspection.rooms);
      const normalized = normalizeInspectionFormData(inspection.formData, formKind);
      const storedFormVersion =
        inspection.formData && typeof inspection.formData === 'object' && 'version' in inspection.formData
          ? (inspection.formData as { version?: unknown }).version
          : undefined;
      const initialForm =
        storedFormVersion === 2
          ? normalized
          : enrichForm(normalized, normalizedRooms, false);
      photoCacheRef.current.clear();
      const liteForm = toLiteForm(initialForm);
      const liteRooms = toLiteRooms(normalizedRooms);
      setFormData(liteForm);
      formDataRef.current = liteForm;
      setRooms(liteRooms);
      roomsRef.current = liteRooms;
      setSaveState('idle');

      const rawAccessibilityPhotos =
        normalized.shared?.accessibilityObstructions?.photos?.filter(
          (photo) => typeof photo?.dataUrl === 'string' && photo.dataUrl.length > 20,
        ) ?? [];
      const cleanedAccessibilityPhotos = liteForm.shared.accessibilityObstructions.photos ?? [];
      if (
        !readOnlyRef.current &&
        inspectionIdRef.current &&
        rawAccessibilityPhotos.length !== cleanedAccessibilityPhotos.length
      ) {
        const generation = bumpSectionGeneration(sectionSaveGeneration.current, 'shared:accessibilityObstructions');
        enqueueSectionSave('shared', 'accessibilityObstructions', generation);
      }
    } catch (err) {
      console.error('Failed to load inspection form data:', err);
      setFormData(null);
      formDataRef.current = null;
      loadedInspectionIdRef.current = undefined;
    }
  }, [enqueueSectionSave, inspection, toLiteForm, toLiteRooms]);

  useEffect(() => {
    const handleBeforeUnload = () => {
      void flushPendingSaves();
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      void flushPendingSaves();
    };
  }, [flushPendingSaves]);

  const scheduleSectionSave = useCallback(
    (realm: InspectionFormRealm, section: string, debounceMs: number) => {
      const timerKey = sectionTimerKey(realm, section);
      const existing = sectionTimers.current.get(timerKey);
      if (existing) clearTimeout(existing);

      const generation = bumpSectionGeneration(sectionSaveGeneration.current, timerKey);

      if (debounceMs <= 0) {
        enqueueSectionSave(realm, section, generation);
        return;
      }

      sectionTimers.current.set(
        timerKey,
        setTimeout(() => {
          enqueueSectionSave(realm, section, generation);
        }, debounceMs),
      );
    },
    [enqueueSectionSave],
  );

  const patchSection = useCallback(
    (realm: InspectionFormRealm, section: string, partial: Record<string, unknown>) => {
      if (readOnly || !inspectionId) return;

      const prev = formDataRef.current;
      if (!prev) return;
      collectPhotosIntoCache(partial, photoCacheRef.current);
      const patched = patchSectionData(prev, realm, section, partial);
      const next = sectionNeedsLiveEnrich(realm, section)
        ? enrichInspectionFormDataForSection(patched, realm, section, {
            rooms: roomsForEnrichment(roomsRef.current),
            preserveAccessibilityPhotos: true,
          })
        : patched;
      const lite = toLiteForm(next);
      formDataRef.current = lite;
      if (hasDefectQuickFlag(partial)) {
        setFormData(lite);
      } else {
        startTransition(() => {
          setFormData(lite);
        });
      }

      scheduleSectionSave(realm, section, saveDebounceMs(partial));
    },
    [inspectionId, readOnly, scheduleSectionSave, toLiteForm],
  );

  const scheduleRoomSave = useCallback(
    (roomId: string, debounceMs: number) => {
      const existing = roomTimers.current.get(roomId);
      if (existing) clearTimeout(existing);

      const generation = bumpSectionGeneration(roomSaveGeneration.current, roomId);

      if (debounceMs <= 0) {
        enqueueRoomSave(roomId, generation);
        return;
      }

      roomTimers.current.set(
        roomId,
        setTimeout(() => {
          enqueueRoomSave(roomId, generation);
        }, debounceMs),
      );
    },
    [enqueueRoomSave],
  );

  const patchRoom = useCallback(
    (roomId: string, partial: Record<string, unknown>) => {
      if (readOnly || !inspectionId) return;

      collectPhotosIntoCache(partial, photoCacheRef.current);
      const nextRooms = roomsRef.current.map((room) =>
        room.id === roomId
          ? {
              ...room,
              data: stripPhotosFromValue({ ...room.data, ...partial }, photoCacheRef.current),
            }
          : room,
      );
      roomsRef.current = nextRooms;
      // Defect quick-actions must paint immediately; deferred transitions can lose to a
      // concurrent refetch and look like Major snapped back to No Major.
      if (hasDefectQuickFlag(partial) || Object.prototype.hasOwnProperty.call(partial, 'photos')) {
        setRooms(nextRooms);
      } else {
        startTransition(() => {
          setRooms(nextRooms);
        });
      }
      if (roomUpdateNeedsEnrich(partial)) {
        scheduleRoomFormEnrich();
      }
      if (hasDefectQuickFlag(partial)) {
        const existing = roomTimers.current.get(roomId);
        if (existing) clearTimeout(existing);
        roomTimers.current.delete(roomId);
        const generation = bumpSectionGeneration(roomSaveGeneration.current, roomId);
        enqueueRoomSave(roomId, generation);
        return;
      }
      scheduleRoomSave(roomId, saveDebounceMs(partial));
    },
    [enqueueRoomSave, inspectionId, readOnly, scheduleRoomFormEnrich, scheduleRoomSave],
  );

  const updateRoomData = useCallback(
    (roomId: string, data: Record<string, unknown>) => {
      if (readOnly || !inspectionId) return;

      const previousRoom = roomsRef.current.find((room) => room.id === roomId);
      collectPhotosIntoCache(data, photoCacheRef.current);
      const nextRooms = roomsRef.current.map((room) =>
        room.id === roomId
          ? { ...room, data: stripPhotosFromValue(data, photoCacheRef.current) }
          : room,
      );
      roomsRef.current = nextRooms;
      startTransition(() => {
        setRooms(nextRooms);
      });
      if (previousRoom && roomDataNeedsEnrich(previousRoom.data, data)) {
        scheduleRoomFormEnrich();
      }
      scheduleRoomSave(roomId, saveDebounceMs(data));
    },
    [inspectionId, readOnly, scheduleRoomFormEnrich, scheduleRoomSave],
  );

  return {
    formData,
    rooms,
    saveState,
    patchSection,
    patchRoom,
    updateRoomData,
    flushPendingSaves,
    photoCache: photoCacheRef.current,
  };
}
