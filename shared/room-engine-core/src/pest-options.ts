/** Pest inspection option lists (AS 4349.3 timber pest workflow). */

import { RISK_LEVELS } from './options.js';

export const TIMBER_PEST_RISK_LEVELS = RISK_LEVELS;

export const TERMITE_EVIDENCE_ANSWERS = [
  'No',
  'The following evidence was found',
] as const;

export const TERMITE_SPECIES_PRESETS = [
  'Undetermined',
  'Schedorhinotermes sp',
  'Coptotermes sp',
  'Nasutitermes sp',
  'Heterotermes sp',
  'Microcerotermes sp',
  'and Schedorhinotermes sp',
  'and Coptotermes sp',
  'and Nasutitermes sp',
  'and Heterotermes sp',
  'and Microcerotermes sp',
] as const;

export const MANAGEMENT_PROPOSAL_OPTIONS = [
  'A proposal is recommended. The installation of a termite management system is recommended to help protect this building from undetected termite attack.',
  'A proposal is not recommended.',
  'The need for a proposal is undetermined.',
] as const;

export const EVIDENCE_FOUND_OPTIONS = ['Evidence Found', 'No Evidence Found'] as const;

export const TERMITE_WORKING_LOCATIONS = [
  'Wall Frames',
  'Flooring',
  'Roof Timbers',
  'Tree Stumps',
  'Landscaping Timbers',
  'Other',
] as const;

export const PREVIOUS_TREATMENT_EVIDENCE = [
  'Treatment notice located in meter box',
  'Treatment notice located in kitchen cupboard',
  'Evidence of a physical termite barrier installation',
  'Evidence of drill holes indicating possible termite barrier installation',
  'Evidence of termite monitoring stations located',
  'Evidence of possible reticulation system installed',
] as const;

export const FUTURE_INSPECTION_FREQUENCIES = ['1 Month', '3 Month', '6 Month'] as const;

export const FUNGAL_DECAY_LOCATIONS = [
  'Timber Flooring',
  'Decking',
  'Pergola',
  'Landscaping Timbers',
  'Tree Stumps',
  'Other',
] as const;

export const CHEMICAL_DELIGNIFICATION_EVIDENCE = [
  'Roof Timbers',
  'Wall Frames',
  'Floor Timbers',
  'Pole Structures',
  'Decking Timbers',
  'Other',
] as const;

export const MAJOR_SAFETY_HAZARD_ITEMS = [
  'Asbestos Suspected',
  'Electrical Hazard',
  'Structural Hazard',
  'Trip Hazard',
  'Other',
] as const;

export const WOOD_BORER_ANSWERS = [
  'No evidence was found.',
  'The following evidence was found:',
  'Presence was undetermined.',
] as const;

export const SUBFLOOR_VENTILATION_ANSWERS = [
  'Not applicable due to construction design.',
  'No evidence was found.',
  'The following evidence was found.',
  'Undetermined due to access restrictions.',
] as const;

export const EXCESSIVE_MOISTURE_ANSWERS = [
  'No evidence was found.',
  'The following evidence was found:',
  'Presence was undetermined.',
] as const;

export const MOISTURE_LOCATION_PRESETS = [
  'Rear of main Shower',
  'Rear of ensuite shower',
  'Under laundry tub',
  'Wet area flooring',
  'Roof space interior',
  'Various ceiling sheets',
  'Staining in eave sheets',
  'Bedroom flooring',
] as const;

export const MOISTURE_STAIN_PRESETS = [
  'Various ceiling sheets',
  'Under laundry tub',
  'Wet area flooring',
  'Roof space interior',
  'Staining in eave sheets',
  'Bedroom flooring',
] as const;

export const BARRIER_BRIDGING_ITEMS = [
  'Paths',
  'Patios',
  'Stored Goods',
  'Landscaping',
  'Foliage',
  'Garden Beds',
  'Air Conditioners',
  'Rendered Walls',
  'Down Pipes',
  'High ground',
] as const;

export const CONDUCIVE_RECOMMENDATION_PRESETS = [
  'Redirection of the hot water service overflow line is recommended to help prevent excessive moisture buildup against the structure',
  'Redirection of the air conditioning unit overflow lines is recommended to help prevent unnecessary moisture buildup against the structure',
  'All tree stumps should be removed from site to help prevent unnecessary termite activity on the property.',
  'All plumbing, including but not necessarily limited to the guttering, downpipes and internal plumbing should be inspected and sealed to help prevent excessive moisture buildup against the structure.',
  'All timber items in ground contact including but not necessarily limited to timber fences, landscaping and retaining wall timbers should be adjusted to provide a minimum of 75mm ground clearance or replaced with termite and decay resistant materials.',
] as const;

export const MAJOR_HAZARD_ANSWERS = ['No Evidence Found', 'Hazard Found'] as const;

export const CONDUCIVE_INSPECTION_ANSWERS = ['Yes', 'No', 'Undetermined'] as const;

export const PEST_CONCLUSION_RECOMMENDATIONS = [
  'Yes, detailed in Section D',
  'No Treatment Required',
] as const;

export const MOISTURE_STAINS_DISCLAIMER =
  'Please note; this refers to visual evidence/staining only. No moisture readings were obtained in these areas at the time of inspection.';

export const ACTIVE_TERMITES_IMPORTANT_NOTE =
  'Important Note. As a delay may exist between the time of an attack and the appearance of telltale signs associated with an attack, it is possible that termite activity and damage exists though not discernible at the time of inspection.';

export const D1_EVIDENCE_REPORT_PREFIX =
  'At time of inspection active termites were located in, but not necessarily limited to:';

export const D3_EVIDENCE_REPORT_PREFIX =
  'At time of inspection termite damage and/or workings were located in, but not necessarily limited to:';

export const D10_EVIDENCE_REPORT_PREFIX =
  'At time of inspection elevated moisture readings were located in, but not necessarily limited to the:';

export const D10_STAINS_REPORT_PREFIX = 'At time of inspection moisture stains were located to:';

/** Wet-area moisture presets that suggest waterproofing / silicone re-sealing. */
export const BATHROOM_MOISTURE_LOCATION_PRESETS = [
  'Rear of main Shower',
  'Rear of ensuite shower',
  'Wet area flooring',
] as const;

/** Roof/ceiling moisture presets that suggest a licensed roofer or roof plumber. */
export const ROOF_MOISTURE_LOCATION_PRESETS = [
  'Roof space interior',
  'Staining in eave sheets',
  'Various ceiling sheets',
] as const;

/** Plumbing-related moisture presets that suggest a licensed plumber. */
export const PLUMBING_MOISTURE_LOCATION_PRESETS = ['Under laundry tub'] as const;
