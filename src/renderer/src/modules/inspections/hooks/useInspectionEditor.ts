import { useCallback, useEffect, useRef, useState } from 'react';
import type { InspectionFormDataV2, InspectionFormRealm } from '@sitescop/room-engine-core';
import {
  enrichInspectionFormData,
  getSectionData,
  jobTypeToFormKind,
  normalizeInspectionFormData,
  patchSectionData,
} from '@sitescop/room-engine-core';
import type { InspectionDetail, InspectionRoomDetail } from '@shared/inspection-types';
import { getSitescopApi } from '@/lib/sitescop-api';

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

const SAVE_DEBOUNCE_MS = 700;

const AUTO_SYNC_KEYS = new Set([
  'shared:accessibilityObstructions',
  'shared:inspectorHazardAssessment',
  'building:conclusion',
  'building:recommendations',
]);

function sectionTimerKey(realm: InspectionFormRealm, section: string): string {
  return `${realm}:${section}`;
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
  const formDataRef = useRef<InspectionFormDataV2 | null>(null);
  const roomsRef = useRef<InspectionRoomDetail[]>([]);

  useEffect(() => {
    if (!inspection) return;
    try {
      const formKind = jobTypeToFormKind(inspection.jobType);
      const enriched = enrichInspectionFormData(
        normalizeInspectionFormData(inspection.formData, formKind),
      );
      setFormData(enriched);
      formDataRef.current = enriched;
      setRooms(inspection.rooms);
      roomsRef.current = inspection.rooms;
      setSaveState('idle');
    } catch (err) {
      console.error('Failed to load inspection form data:', err);
      setFormData(null);
      formDataRef.current = null;
    }
  }, [inspection?.id, inspection?.updatedAt, inspection?.jobType, inspection?.formData, inspection?.rooms]);

  useEffect(() => {
    return () => {
      sectionTimers.current.forEach(clearTimeout);
      roomTimers.current.forEach(clearTimeout);
    };
  }, []);

  const flashSaved = useCallback(() => {
    setSaveState('saved');
    setTimeout(() => setSaveState('idle'), 1500);
  }, []);

  const patchSection = useCallback(
    (realm: InspectionFormRealm, section: string, partial: Record<string, unknown>) => {
      if (readOnly || !inspectionId) return;

      setFormData((prev) => {
        if (!prev) return prev;
        const patched = patchSectionData(prev, realm, section, partial);
        const next = enrichInspectionFormData(patched);
        formDataRef.current = next;
        return next;
      });

      const timerKey = sectionTimerKey(realm, section);
      const existing = sectionTimers.current.get(timerKey);
      if (existing) clearTimeout(existing);

      setSaveState('saving');
      sectionTimers.current.set(
        timerKey,
        setTimeout(async () => {
          const current = formDataRef.current;
          if (!current) {
            setSaveState('idle');
            return;
          }

          const sectionData = getSectionData(current, realm, section);
          if (!sectionData) {
            setSaveState('idle');
            return;
          }

          try {
            const result = await getSitescopApi().inspections.updateSection(inspectionId, {
              realm,
              section,
              data: sectionData,
            });

            if (realm === 'shared' && section === 'propertyDescription') {
              setRooms(result.inspection.rooms);
              roomsRef.current = result.inspection.rooms;
            }

            const syncKey = sectionTimerKey(realm, section);
            if (AUTO_SYNC_KEYS.has(syncKey) || realm === 'pest') {
              setFormData((prev) => {
                if (!prev) return prev;
                const server = result.inspection.formData;
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
                formDataRef.current = next;
                return next;
              });
            }

            flashSaved();
          } catch {
            setSaveState('error');
            setTimeout(() => setSaveState('idle'), 3000);
          }
        }, SAVE_DEBOUNCE_MS),
      );
    },
    [flashSaved, inspectionId, readOnly],
  );

  const patchRoom = useCallback(
    (roomId: string, partial: Record<string, unknown>) => {
      if (readOnly || !inspectionId) return;

      setRooms((prev) => {
        const next = prev.map((room) =>
          room.id === roomId ? { ...room, data: { ...room.data, ...partial } } : room,
        );
        roomsRef.current = next;
        return next;
      });

      const existing = roomTimers.current.get(roomId);
      if (existing) clearTimeout(existing);

      setSaveState('saving');
      roomTimers.current.set(
        roomId,
        setTimeout(async () => {
          const room = roomsRef.current.find((entry) => entry.id === roomId);
          if (!room) {
            setSaveState('idle');
            return;
          }

          try {
            await getSitescopApi().inspections.updateRoom(inspectionId, roomId, { data: room.data });
            flashSaved();
          } catch {
            setSaveState('error');
            setTimeout(() => setSaveState('idle'), 3000);
          }
        }, SAVE_DEBOUNCE_MS),
      );
    },
    [flashSaved, inspectionId, readOnly],
  );

  const updateRoomData = useCallback(
    (roomId: string, data: Record<string, unknown>) => {
      if (readOnly || !inspectionId) return;

      setRooms((prev) => {
        const next = prev.map((room) => (room.id === roomId ? { ...room, data } : room));
        roomsRef.current = next;
        return next;
      });

      const existing = roomTimers.current.get(roomId);
      if (existing) clearTimeout(existing);

      setSaveState('saving');
      roomTimers.current.set(
        roomId,
        setTimeout(async () => {
          const room = roomsRef.current.find((entry) => entry.id === roomId);
          if (!room) {
            setSaveState('idle');
            return;
          }

          try {
            await getSitescopApi().inspections.updateRoom(inspectionId, roomId, { data: room.data });
            flashSaved();
          } catch {
            setSaveState('error');
            setTimeout(() => setSaveState('idle'), 3000);
          }
        }, SAVE_DEBOUNCE_MS),
      );
    },
    [flashSaved, inspectionId, readOnly],
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
