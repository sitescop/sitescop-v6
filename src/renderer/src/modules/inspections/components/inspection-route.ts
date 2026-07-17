import { InspectionRoomType, type InspectionRoomDetail } from '@shared/inspection-types';

export type InspectionRouteFormKind = 'BUILDING' | 'PEST' | 'COMBINED';
export type InspectionRouteMode = 'full' | 'shared-only' | 'building-only' | 'pest-only';

export interface InspectionRouteContext {
  formKind: InspectionRouteFormKind;
  mode?: InspectionRouteMode;
  subfloorApplicable: boolean;
  rooms?: InspectionRoomDetail[];
  includePest?: boolean;
}

const SHARED_ROUTE = [
  'inspector-hazard',
  'job-information',
  'property-description',
  'services',
  'accessibility',
  'site-conditions',
  'external',
  'subfloor',
  'fencing',
  'outbuildings',
  'roof-exterior',
  'roof-space',
] as const;

/** Pest-only jobs: shared sections through Site Conditions, then straight into pest D1–D14. */
const PEST_SHARED_ROUTE = [
  'inspector-hazard',
  'job-information',
  'property-description',
  'services',
  'accessibility',
  'site-conditions',
] as const;

/** Outside perimeter after roof — garage only (subfloor/fencing/outbuildings sit before roof). */
const OUTSIDE_PERIMETER_ROUTE = ['garage'] as const;

/** Interior wet areas and living spaces. */
const INTERIOR_ROUTE = ['bathrooms', 'kitchen', 'laundry', 'bedrooms', 'living-areas'] as const;

const BUILDING_CLOSEOUT_ROUTE = [
  'corrosion',
  'minor-defects',
  'major-defects',
  'moisture-testing',
  'conclusion',
  'recommendations',
  'inspector-declaration',
] as const;

const PEST_ROUTE = [
  'pest-risk',
  'pest-d1ActiveTermites',
  'pest-d2ManagementProposal',
  'pest-d3TermiteWorkings',
  'pest-d4PreviousTreatment',
  'pest-d5FutureInspection',
  'pest-d6ChemicalDelignification',
  'pest-d7FungalDecay',
  'pest-d8WoodBorers',
  'pest-d9SubfloorVentilation',
  'pest-d10ExcessiveMoisture',
  'pest-d11BarrierBridging',
  'pest-d12UntreatedTimber',
  'pest-d13ConduciveConditions',
  'pest-d14MajorSafetyHazards',
  'pest-conclusion',
] as const;

function roomFlags(rooms: InspectionRoomDetail[] = []) {
  return {
    hasBathrooms: rooms.some((room) => room.roomType === InspectionRoomType.BATHROOM),
    hasBedrooms: rooms.some((room) => room.roomType === InspectionRoomType.BEDROOM),
    hasLiving: rooms.some((room) => room.roomType === InspectionRoomType.LIVING),
    hasGarage: rooms.some((room) => room.roomType === InspectionRoomType.GARAGE),
  };
}

function filterRouteIds(ids: readonly string[], ctx: InspectionRouteContext): string[] {
  const { hasBathrooms, hasBedrooms, hasLiving, hasGarage } = roomFlags(ctx.rooms);

  return ids.filter((id) => {
    if (id === 'subfloor' && !ctx.subfloorApplicable) return false;
    if (id === 'pest-d9SubfloorVentilation' && !ctx.subfloorApplicable) return false;
    if (id === 'bathrooms' && !hasBathrooms) return false;
    if (id === 'bedrooms' && !hasBedrooms) return false;
    if (id === 'living-areas' && !hasLiving) return false;
    if (id === 'garage' && !hasGarage) return false;
    return true;
  });
}

/** On-site workflow: pre-inspection → outside → inside → outside perimeter → closeout → pest. */
export function buildInspectionRouteIds(ctx: InspectionRouteContext): string[] {
  const mode = ctx.mode ?? 'full';
  const includePest = ctx.includePest ?? (ctx.formKind === 'PEST' || ctx.formKind === 'COMBINED');

  if (mode === 'shared-only') {
    return filterRouteIds(SHARED_ROUTE, ctx);
  }

  if (mode === 'building-only') {
    return filterRouteIds(
      [...OUTSIDE_PERIMETER_ROUTE, ...INTERIOR_ROUTE, ...BUILDING_CLOSEOUT_ROUTE],
      ctx,
    );
  }

  if (mode === 'pest-only') {
    return filterRouteIds(PEST_ROUTE, ctx);
  }

  if (ctx.formKind === 'PEST' && !includePest) {
    return filterRouteIds(PEST_SHARED_ROUTE, ctx);
  }

  const buildingRoute = [
    ...SHARED_ROUTE,
    ...OUTSIDE_PERIMETER_ROUTE,
    ...INTERIOR_ROUTE,
    ...BUILDING_CLOSEOUT_ROUTE,
  ];

  if (ctx.formKind === 'BUILDING') {
    return filterRouteIds(buildingRoute, ctx);
  }

  if (ctx.formKind === 'PEST') {
    return [...filterRouteIds(PEST_SHARED_ROUTE, ctx), ...filterRouteIds(PEST_ROUTE, ctx)];
  }

  // COMBINED — full building path then pest sections
  return [...filterRouteIds(buildingRoute, ctx), ...filterRouteIds(PEST_ROUTE, ctx)];
}

export function getAdjacentRouteSection(
  routeIds: string[],
  currentId: string,
  direction: 'next' | 'previous',
): string | null {
  const index = routeIds.indexOf(currentId);
  if (index === -1) return direction === 'next' ? routeIds[0] ?? null : null;
  const nextIndex = direction === 'next' ? index + 1 : index - 1;
  if (nextIndex < 0 || nextIndex >= routeIds.length) return null;
  return routeIds[nextIndex] ?? null;
}
