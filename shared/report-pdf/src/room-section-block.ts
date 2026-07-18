import {
  applyInaccessibleReasonComment,
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
  inaccessible?: {
    collapseFields?: boolean;
    inaccessibleArea?: string | null;
    inaccessibleReason?: string;
  },
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
  let sectionData: Record<string, unknown> =
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
        : { ...room.data };

  const collapseFields = Boolean(inaccessible?.collapseFields);
  if (collapseFields && inaccessible?.inaccessibleArea) {
    sectionData = {
      ...sectionData,
      comments: applyInaccessibleReasonComment(
        typeof sectionData.comments === 'string' ? sectionData.comments : '',
        inaccessible.inaccessibleArea,
        inaccessible.inaccessibleReason ?? '',
      ),
    };
  }

  return renderSectionBlock(
    title,
    sectionData,
    new Set(),
    undefined,
    getRoomFieldDefs(room.roomType, room.roomIndex),
    { collapseFields },
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
