import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Check } from 'lucide-react';
import { InspectionRoomType } from '@shared/inspection-types';
import type { InspectionRoomDetail } from '@shared/inspection-types';
import { resolveRoomReportLabels } from '@sitescop/room-engine-core';
import { Button } from '@/design-system/components';
import { cn } from '@/lib/cn';
import { getSingleRoomStatus } from '@/modules/inspections/components/section-completion';

const ROOM_ROUTE_TYPES: Record<string, InspectionRoomType> = {
  bathrooms: InspectionRoomType.BATHROOM,
  bedrooms: InspectionRoomType.BEDROOM,
  'living-areas': InspectionRoomType.LIVING,
  garage: InspectionRoomType.GARAGE,
};

interface RoomSectionHostProps {
  routeId: keyof typeof ROOM_ROUTE_TYPES;
  rooms: InspectionRoomDetail[];
  children: (room: InspectionRoomDetail, label: string) => ReactNode;
}

export function RoomSectionHost({ routeId, rooms, children }: RoomSectionHostProps) {
  const roomType = ROOM_ROUTE_TYPES[routeId];
  const filtered = useMemo(() => rooms.filter((room) => room.roomType === roomType), [rooms, roomType]);
  const labels = useMemo(
    () =>
      resolveRoomReportLabels(
        filtered.map((room) => ({
          roomType: room.roomType,
          roomIndex: room.roomIndex,
          label: room.label,
          data: room.data,
        })),
      ),
    [filtered],
  );
  const roomStatuses = useMemo(
    () => filtered.map((room) => getSingleRoomStatus(room, roomType)),
    [filtered, roomType],
  );
  const [activeIndex, setActiveIndex] = useState(0);
  const safeIndex = filtered.length === 0 ? 0 : Math.min(activeIndex, filtered.length - 1);
  const activeRoom = filtered[safeIndex];

  if (filtered.length === 0) {
    return <p className="text-sm text-text-muted">No rooms configured for this section.</p>;
  }

  return (
    <div className="space-y-4">
      {filtered.length > 1 ? (
        <div className="sticky top-0 z-20 -mx-1 mb-1 flex flex-wrap gap-2 border-b-2 border-[#0B4F8C] bg-[#0B4F8C] px-2 py-3 shadow-md">
          {filtered.map((room, index) => {
            const isActive = index === safeIndex;
            const isCompleted = roomStatuses[index] === 'completed';
            return (
              <Button
                key={room.id}
                type="button"
                size="sm"
                variant="ghost"
                className={cn(
                  'inline-flex max-w-full items-center gap-1.5 truncate border-2 font-semibold shadow-sm',
                  isCompleted && isActive
                    ? 'border-white bg-[#15803D] text-white hover:bg-[#166534] hover:text-white'
                    : isCompleted
                      ? 'border-[#15803D] bg-[#16A34A] text-white hover:bg-[#15803D] hover:text-white'
                      : isActive
                        ? 'border-white bg-[#F39C12] text-white hover:bg-[#E08E0B] hover:text-white'
                        : 'border-white/80 bg-white text-[#0B4F8C] hover:bg-[#E8F4FF] hover:text-[#0B4F8C]',
                )}
                onClick={() => setActiveIndex(index)}
              >
                {isCompleted ? <Check className="h-3.5 w-3.5 shrink-0" strokeWidth={3} aria-hidden /> : null}
                <span className="truncate">{labels[index]}</span>
              </Button>
            );
          })}
        </div>
      ) : null}
      {activeRoom ? (
        <div key={activeRoom.id} className="[content-visibility:auto] [contain-intrinsic-size:1px_1200px]">
          {children(activeRoom, labels[safeIndex] ?? activeRoom.label)}
        </div>
      ) : null}
    </div>
  );
}

export function isRoomRouteId(routeId: string): routeId is keyof typeof ROOM_ROUTE_TYPES {
  return routeId in ROOM_ROUTE_TYPES;
}
