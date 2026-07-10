import {
  isNoMajorDefectObserved,
  noMajorDefectRoomPdfComments,
  resolveRoomReportLabels,
  type RoomReportLabelInput,
} from '../../room-engine-core/src/index.js';
import type { ReportRoomInfo } from './types.js';
import { getRoomFieldDefs } from './section-fields.js';
import { renderSectionBlock } from './html-utils.js';

export function renderRoomSectionBlock(
  room: ReportRoomInfo,
  resolvedLabels: string[],
  labelIndex: number,
): string {
  const noMajorDefect = isNoMajorDefectObserved(
    room.data as { noMajorDefectObserved?: boolean; comments?: string },
  );
  const title = noMajorDefect ? room.label : resolvedLabels[labelIndex];
  const sectionData = noMajorDefect
    ? {
        ...room.data,
        comments: noMajorDefectRoomPdfComments(room.roomType, room.data),
      }
    : room.data;

  return renderSectionBlock(
    title,
    sectionData,
    new Set(),
    undefined,
    getRoomFieldDefs(room.roomType, room.roomIndex),
  );
}

export function resolveSortedRoomReportLabels(rooms: ReportRoomInfo[]): string[] {
  const inputs: RoomReportLabelInput[] = rooms.map((room) => ({
    roomType: room.roomType,
    roomIndex: room.roomIndex,
    label: room.label,
    data: room.data,
  }));
  return resolveRoomReportLabels(inputs);
}
