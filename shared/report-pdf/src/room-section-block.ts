import {
  isMajorDefectObserved,
  isNoMajorDefectObserved,
  majorDefectRoomPdfComments,
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
  const data = room.data as {
    noMajorDefectObserved?: boolean;
    majorDefectObserved?: boolean;
    comments?: string;
  };
  const noMajorDefect = isNoMajorDefectObserved(data);
  const majorDefect = isMajorDefectObserved(data);
  // Always prefer resolved labels (Master Bedroom, Ensuite, Bedroom 1…) over the
  // static DB room.label ("Bedroom 1") so PDF matches the type selected in workspace.
  const title = resolvedLabels[labelIndex] || room.label;
  const sectionData =
    noMajorDefect
      ? {
          ...room.data,
          comments: noMajorDefectRoomPdfComments(room.roomType, room.data),
        }
      : majorDefect
        ? {
            ...room.data,
            comments: majorDefectRoomPdfComments(room.roomType, room.data),
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
