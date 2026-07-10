import { useCallback, useEffect, useRef, useState } from 'react';
import type { InspectionFormDataV2, InspectionFormRealm, MajorDefectRollupRoom } from '@sitescop/room-engine-core';
import {
  enrichInspectionFormData,
  getSectionData,
  jobTypeToFormKind,
  mergeRoomDataForReport,
  normalizeInspectionFormData,
  patchSectionData,
} from '@sitescop/room-engine-core';
import type { InspectionDetail, InspectionRoomDetail } from '@shared/inspection-types';
import { getSitescopApi } from '@/lib/sitescop-api';

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

const SAVE_DEBOUNCE_MS = 700;
const PHOTO_SAVE_DEBOUNCE_MS = 0;

const AUTO_SYNC_KEYS = new Set([
  'shared:accessibilityObstructions',
  'shared:inspectorHazardAssessment',
  'building:conclusion',
  'building:recommendations',
]);

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

function sectionTimerKey(realm: InspectionFormRealm, section: string): string {
  return `${realm}:${section}`;
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
  return Object.prototype.hasOwnProperty.call(partial, 'photos') ? PHOTO_SAVE_DEBOUNCE_MS : SAVE_DEBOUNCE_MS;
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
  const sectionSaveGeneration = useRef<Map<string, number>>(new Map());
  const sectionSaveChains = useRef<Map<string, Promise<void>>>(new Map());
  const formDataRef = useRef<InspectionFormDataV2 | null>(null);
  const roomsRef = useRef<InspectionRoomDetail[]>([]);
  const inspectionIdRef = useRef(inspectionId);
  const readOnlyRef = useRef(readOnly);
  const activeSaveCountRef = useRef(0);

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

      activeSaveCountRef.current += 1;
      setSaveState('saving');
      try {
        if (sectionSaveGeneration.current.get(timerKey) !== expectedGeneration) return;

        const result = await getSitescopApi().inspections.updateSection(currentInspectionId, {
          realm,
          section,
          data: sectionData,
        });

        if (sectionSaveGeneration.current.get(timerKey) !== expectedGeneration) return;

        if (realm === 'shared' && section === 'propertyDescription') {
          const normalizedRooms = enrichRooms(result.inspection.rooms);
          setRooms(normalizedRooms);
          roomsRef.current = normalizedRooms;
        }

        const syncKey = sectionTimerKey(realm, section);
        if (AUTO_SYNC_KEYS.has(syncKey) || realm === 'pest') {
          setFormData((prev) => {
            if (!prev) return prev;
            if (sectionSaveGeneration.current.get(timerKey) !== expectedGeneration) return prev;
            const next = applyServerSectionSync(prev, realm, section, result.inspection.formData);
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
    [applyServerSectionSync, flashSaved],
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
    async (roomId: string) => {
      const currentInspectionId = inspectionIdRef.current;
      if (readOnlyRef.current || !currentInspectionId) return;

      const room = roomsRef.current.find((entry) => entry.id === roomId);
      if (!room) return;

      activeSaveCountRef.current += 1;
      setSaveState('saving');
      try {
        await getSitescopApi().inspections.updateRoom(currentInspectionId, roomId, { data: room.data });
        flashSaved();
      } catch {
        setSaveState('error');
        setTimeout(() => setSaveState('idle'), 3000);
      } finally {
        activeSaveCountRef.current = Math.max(0, activeSaveCountRef.current - 1);
      }
    },
    [flashSaved],
  );

  const flushPendingSaves = useCallback(() => {
    for (const [timerKey, timer] of [...sectionTimers.current.entries()]) {
      clearTimeout(timer);
      sectionTimers.current.delete(timerKey);
      const parsed = parseSectionTimerKey(timerKey);
      if (parsed) {
        const generation = bumpSectionGeneration(sectionSaveGeneration.current, timerKey);
        enqueueSectionSave(parsed.realm, parsed.section, generation);
      }
    }
    for (const [roomId, timer] of [...roomTimers.current.entries()]) {
      clearTimeout(timer);
      roomTimers.current.delete(roomId);
      void persistRoom(roomId);
    }
  }, [enqueueSectionSave, persistRoom]);

  useEffect(() => {
    if (!inspection) return;
    try {
      const formKind = jobTypeToFormKind(inspection.jobType);
      const normalizedRooms = enrichRooms(inspection.rooms);
      const normalized = normalizeInspectionFormData(inspection.formData, formKind);
      const enriched = enrichForm(normalized, normalizedRooms, false);
      setFormData(enriched);
      formDataRef.current = enriched;
      setRooms(normalizedRooms);
      roomsRef.current = normalizedRooms;
      setSaveState('idle');

      const rawAccessibilityPhotos =
        normalized.shared?.accessibilityObstructions?.photos?.filter(
          (photo) => typeof photo?.dataUrl === 'string' && photo.dataUrl.length > 20,
        ) ?? [];
      const cleanedAccessibilityPhotos = enriched.shared.accessibilityObstructions.photos ?? [];
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
    }
  }, [enqueueSectionSave, inspection?.id, inspection?.updatedAt, inspection?.jobType, inspection?.formData, inspection?.rooms]);

  useEffect(() => {
    const handleBeforeUnload = () => {
      flushPendingSaves();
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      flushPendingSaves();
    };
  }, [flushPendingSaves]);

  const scheduleSectionSave = useCallback(
    (realm: InspectionFormRealm, section: string, debounceMs: number) => {
      const timerKey = sectionTimerKey(realm, section);
      const existing = sectionTimers.current.get(timerKey);
      if (existing) clearTimeout(existing);

      const generation = bumpSectionGeneration(sectionSaveGeneration.current, timerKey);
      setSaveState('saving');

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

      setFormData((prev) => {
        if (!prev) return prev;
        const patched = patchSectionData(prev, realm, section, partial);
        const next = enrichForm(patched, roomsRef.current, true);
        formDataRef.current = next;
        return next;
      });

      scheduleSectionSave(realm, section, saveDebounceMs(partial));
    },
    [inspectionId, readOnly, scheduleSectionSave],
  );

  const scheduleRoomSave = useCallback(
    (roomId: string, debounceMs: number) => {
      const existing = roomTimers.current.get(roomId);
      if (existing) clearTimeout(existing);

      setSaveState('saving');
      roomTimers.current.set(
        roomId,
        setTimeout(() => {
          roomTimers.current.delete(roomId);
          void persistRoom(roomId);
        }, debounceMs),
      );
    },
    [persistRoom],
  );

  const patchRoom = useCallback(
    (roomId: string, partial: Record<string, unknown>) => {
      if (readOnly || !inspectionId) return;

      setRooms((prev) => {
        const nextRooms = prev.map((room) =>
          room.id === roomId ? { ...room, data: { ...room.data, ...partial } } : room,
        );
        roomsRef.current = nextRooms;
        setFormData((current) => {
          if (!current?.building) return current;
          const enriched = enrichInspectionFormData(current, { rooms: roomsForEnrichment(nextRooms) });
          formDataRef.current = enriched;
          return enriched;
        });
        return nextRooms;
      });

      scheduleRoomSave(roomId, saveDebounceMs(partial));
    },
    [inspectionId, readOnly, scheduleRoomSave],
  );

  const updateRoomData = useCallback(
    (roomId: string, data: Record<string, unknown>) => {
      if (readOnly || !inspectionId) return;

      setRooms((prev) => {
        const nextRooms = prev.map((room) => (room.id === roomId ? { ...room, data } : room));
        roomsRef.current = nextRooms;
        setFormData((current) => {
          if (!current?.building) return current;
          const enriched = enrichInspectionFormData(current, { rooms: roomsForEnrichment(nextRooms) });
          formDataRef.current = enriched;
          return enriched;
        });
        return nextRooms;
      });

      scheduleRoomSave(roomId, saveDebounceMs(data));
    },
    [inspectionId, readOnly, scheduleRoomSave],
  );

  return {
    formData,
    rooms,
    saveState,
    patchSection,
    patchRoom,
    updateRoomData,
  };
}
