/** Shared option lists for building inspection forms (V4 functional blueprint). */

export const DEFAULT_WEATHER_CONDITIONS = 'Fine and sunny';
export const DEFAULT_OCCUPANCY_STATUS = 'Occupied and fully furnished';
export const DEFAULT_INCOMPLETE_CONSTRUCTION = 'No evidence found';

export const WEATHER_CONDITIONS_OPTIONS = [
  'Fine and sunny',
  'Overcast',
  'Light rain',
  'Heavy rain',
  'Windy',
  'Hot and humid',
  'Not applicable',
] as const;

export const OCCUPANCY_STATUS_OPTIONS = [
  'Occupied and fully furnished',
  'Occupied and partially furnished',
  'Unoccupied and furnished',
  'Unoccupied and unfurnished',
  'Vacant',
  'Under construction',
] as const;

export const INCOMPLETE_CONSTRUCTION_OPTIONS = [
  'No evidence found',
  'Incomplete construction observed',
  'Renovations incomplete',
  'Alterations incomplete',
  'Extension incomplete',
  'Building works in progress',
  'Unable to determine',
  'Not inspected',
] as const;

export const CLIENT_TYPES = ['Owner', 'Purchaser', 'Agent', 'Conveyancer', 'Solicitor', 'Other'] as const;

/** Who ordered the inspection — maps to Job Information client type. */
export const ORDERING_PARTY_TYPES = [
  { value: '', label: 'None' },
  { value: 'Agent', label: 'Real estate agent' },
  { value: 'Conveyancer', label: 'Conveyancer' },
  { value: 'Solicitor', label: 'Solicitor' },
  { value: 'Other', label: 'Other' },
] as const;

export function isOrderingPartyClientType(clientType: string | undefined | null): boolean {
  const value = clientType?.trim() ?? '';
  return value === 'Agent' || value === 'Conveyancer' || value === 'Solicitor' || value === 'Other';
}

export const WATER_SUPPLY_OPTIONS = ['Town Water', 'Tank Water', 'Bore Water'] as const;
export const SEWER_OPTIONS = ['Town Sewer', 'Septic', 'Aerated System'] as const;
export const ELECTRICITY_OPTIONS = ['Mains', 'Solar + Mains', 'Generator'] as const;
export const GAS_OPTIONS = ['None', 'Natural Gas', 'LPG'] as const;

export const HOT_WATER_TYPES = ['Electric', 'Gas', 'Solar', 'Heat Pump'] as const;
export const HOT_WATER_LOCATION_OPTIONS = ['External', 'Internal'] as const;
export const AC_TYPES = ['Split System', 'Ducted', 'Evaporative', 'Multi Split', 'Window Unit'] as const;
export const YES_NO_NA = ['Yes', 'No', 'N/A'] as const;
export const YES_NO = ['Yes', 'No'] as const;

export const PROPERTY_TYPES = ['Detached House', 'Duplex', 'Unit', 'Townhouse', 'Villa', 'Other'] as const;
export const POSITION_ON_BLOCK = ['Front', 'Middle', 'Rear'] as const;
export const ORIENTATIONS = [
  'North',
  'South',
  'East',
  'West',
  'North East',
  'North West',
  'South East',
  'South West',
] as const;
export const STOREYS = ['Single', 'Double', 'Multi'] as const;

export const WALL_MATERIALS = [
  'Brick Veneer',
  'Double Brick',
  'Hebel',
  'Cladding',
  'Weatherboard',
  'Rendered Masonry',
  'Fibre Cement',
] as const;
export const FRAME_MATERIALS = ['Timber', 'Steel', 'Masonry'] as const;
export const ROOF_MATERIALS = ['Concrete Tile', 'Terracotta Tile', 'Metal Roof', 'Slate', 'Membrane'] as const;
export const FLOOR_MATERIALS = ['Concrete Slab', 'Timber Floor', 'Suspended Timber'] as const;
export const FENCING_MATERIALS = ['Timber', 'Colorbond', 'Steel Sheet', 'Masonry', 'Chain Wire'] as const;

export const ACCESSIBILITY_AREAS = [
  'Interior',
  'Exterior',
  'Roof Space',
  'Subfloor',
  'Site',
  'Outbuilding',
  'Roof Exterior',
] as const;

export const INTERIOR_OBSTRUCTIONS = [
  'Wall linings',
  'Ceiling linings',
  'Floor coverings',
  'Window furniture',
  'Cabinetry',
  'Appliances',
  'Storage to cupboards',
  'Excessive storage to garage',
  'Furniture and stored goods will limit access',
  'Storage to garage',
  'Excessive furniture and/or stored items to some areas',
  'Hot water service',
] as const;

export const EXTERIOR_OBSTRUCTIONS = [
  'Air conditioning',
  'Hot water service',
  'Landscaping',
  'Foliage',
  'Gates and fences',
  'Pathways and additional slabs',
  'Stored items',
  'External cabinetry',
  'Render or texture coat',
  'Additional cladding',
  'Garden storage shed',
  'Decking',
  'Additional construction',
  'Excessive foliage',
  'Adjacent dwellings & common property',
  'Rainwater tank',
  'Gas storage cylinders',
  'Pool pump assembly',
  'Not applicable',
] as const;

export const ROOF_SPACE_OBSTRUCTIONS = [
  'Low pitched and boxed in areas in roof space',
  'The roof space at the eaves has insufficient clearance for safe access and inspection.',
  'Insulation',
  'Sarking',
  'Ducting and/or machinery',
  'Insulated sarking',
  'Stored goods',
  'Inspection of roof space was impacted due to access restrictions',
  'Not applicable',
  'Raked ceiling areas',
] as const;

export const SUBFLOOR_OBSTRUCTIONS = [
  'Stored goods or furniture',
  'Building materials',
  'Debris or rubbish',
  'Low ground clearance',
  'Ducted air-conditioning ducts',
  'Plumbing pipes',
  'Sewer or stormwater pipes',
  'Electrical conduits or cables',
  'Restricted or undersized access hatch',
  'Standing water or flooding',
  'Mud or soft ground',
  'Animal activity (snakes, rodents, spiders)',
  'Not applicable',
] as const;

export const INACCESSIBLE_AREA_PRESETS = [
  'All areas permitted entry',
  'Foil insulation health and safety risk — expert advice recommended',
  'Locked room(s)',
  'Locked garage/shed',
  'No roof space access hatch',
  'Insufficient roof space clearance',
  'Unsafe roof access',
  'Unsafe subfloor access',
  'Subfloor access obstructed',
  'Stored goods restricting access',
  'Furniture restricting access',
  'Vegetation restricting access',
  'Construction materials restricting access',
  'Electrical hazards present',
  'Animal/pest activity restricting access',
  'Moisture/flooding restricting access',
  'Not applicable',
] as const;

export const HAZARD_ASSESSMENT_LEVELS = ['Low', 'Moderate', 'High'] as const;

export const INSPECTOR_HAZARD_PRESETS = [
  'Aggressive dog',
  'Dangerous or unrestrained animal',
  'Aggressive or hostile client',
  'Other',
] as const;

export const RISK_LEVELS = [
  'Low',
  'Low To Moderate',
  'Moderate',
  'Moderate To High',
  'High',
  'Extreme',
] as const;

export const LAND_SLOPE = ['Generally Level', 'Gentle Slope', 'Moderate Slope', 'Steep Slope'] as const;
export const CONDITION_RATING = ['Good', 'Fair', 'Poor'] as const;
export const DRAINAGE_RATING = ['Adequate', 'Fair', 'Poor'] as const;

export const SITE_DRAINAGE_CONCERNS = [
  'Water Pooling',
  'Poor Surface Drainage',
  'Inadequate Fall Away From Building',
  'Erosion',
  'Saturated Ground',
  'Ponding Adjacent To Building',
  'Downpipe Discharge Issue',
] as const;

export const EXTERNAL_DEFECTS = [
  'External Walls',
  'Windows',
  'External Doors',
  'Paths',
  'Driveways',
  'Decks',
  'Pergolas',
  'Stairs',
  'Balustrades',
] as const;

export const DAMAGE_OBSERVED = ['Cracking', 'Deformation', 'Moisture Damage', 'Corrosion'] as const;

export const ROOF_EXTERIOR_DEFECTS = [
  'Roof Covering',
  'Ridge Capping',
  'Flashings',
  'Gutters',
  'Downpipes',
] as const;

export const ROOF_SPACE_DEFECTS = ['Roof Framing', 'Insulation', 'Ventilation', 'Moisture Evidence'] as const;

/** Clickable roof-space framing members for the interactive diagram. */
export const ROOF_FRAMING_ELEMENTS = [
  'Rafter',
  'Under-purlin',
  'Purlin',
  'Collar tie',
  'Ridge board',
  'Ceiling joist',
  'Strut',
  'Hanging beam',
  'Wall plate',
] as const;

/** Defect conditions selectable after clicking a roof framing member. */
export const ROOF_FRAMING_DEFECT_CONDITIONS = [
  'Bending',
  'Sagging',
  'Cracking',
  'Not braced properly',
  'Not enough support',
] as const;

/** Trades selectable after clicking a roof framing member. */
export const ROOF_FRAMING_TRADE_RECOMMENDATIONS = [
  'Structural engineer',
  'Carpenter',
  'Roofer',
] as const;

export const BATHROOM_TYPES = ['Main', 'Ensuite', 'Master bed', 'Toilet'] as const;

export const BATHROOM_FIXTURES = [
  'Toilet',
  'Vanity Cabinet',
  'Basin',
  'Bath',
  'Shower Base / Shower Tray',
  'Shower Screen',
  'Shower Head',
  'Taps & Mixers',
  'Floor Waste',
  'Mirror',
  'Towel Rail',
  'Toilet Roll Holder',
  'Soap Holder',
  'Exhaust Fan',
  'Heat Lamp',
  'Light Fittings',
  'Power Points',
  'Bidet',
  'Spa Bath',
] as const;

export const BATHROOM_SURFACE_CONDITION = ['Good', 'Fair', 'Poor', 'Damaged'] as const;

export const BATHROOM_FLOOR_TILE_STATUS = [
  'Good',
  'Fair',
  'Poor',
  'Damaged',
  'Broken/Cracked',
  'Loose',
  'Hollow Sounding',
] as const;

export const BATHROOM_WALL_TILE_STATUS = [
  'Good',
  'Fair',
  'Poor',
  'Damaged',
  'Broken/Cracked',
  'Loose',
  'Hollow Sounding',
] as const;

export const BATHROOM_GROUT_CONDITION = ['Good', 'Fair', 'Missing', 'Deteriorated'] as const;

export const BATHROOM_WATER_POOLING_CAUSES = [
  'Inadequate Fall to Floor Waste',
  'Back Fall to Floor Waste',
  'Uneven Tiles',
  'Water Retained in Shower Niche',
] as const;

export const BATHROOM_DOOR_STATUS = ['Good', 'Fair', 'Poor', 'Moisture Damage', 'Not Operating'] as const;

export const BATHROOM_JAMB_STATUS = ['Good', 'Fair', 'Poor', 'Moisture Damage'] as const;

export const BEDROOM_TYPES = ['Bedroom', 'Master Bedroom', 'Guest Bedroom', 'Study', 'Nursery'] as const;

export const LIVING_AREA_NAMES = [
  'Front Living',
  'Rear Living',
  'Family Room',
  'Dining Room',
  'Rumpus Room',
  'Theatre Room',
  'Study',
  'Guest Room',
  'Nursery',
] as const;

export const GARAGE_DEFECTS = [
  'Door',
  'Roller shutter door',
  'Window',
  'Sliding Door',
  'Floor',
  'Walls',
  'Ceiling',
  'Lights',
  'Switches',
  'Power Points',
  'Damage Observed',
] as const;

export const SUBFLOOR_ELEMENTS = ['Ventilation', 'Drainage', 'Moisture', 'Structural Elements'] as const;

export const OUTBUILDING_TYPES = [
  'Shed',
  'Granny Flat',
  'Workshop',
  'Detached Garage',
  'Carport',
  'Pergola',
] as const;

export const CORROSION_ITEMS = [
  'Hot Water System',
  'Kitchen Cabinet',
  'Laundry Cabinet',
  'Roof Sheeting',
  'Gutters',
  'Downpipes',
  'Flashings',
  'Structural Steel',
] as const;

export const MINOR_DEFECT_PRESETS = [
  'External walls - hairline cracks evident to rendered finish',
  'External walls - weep holes covered up or missing in locations',
  'Roof - concrete roof tiles weathered and deteriorated',
  'Roof - minor sagging noticeable in roof line',
  'Drainage - surface water drainage points appear inadequate',
  'Asbestos - possible asbestos linings evident. Recommend immediate sample and testing.',
  'Wall and ceiling linings - scuffs, dents, scratches and blemishes generally throughout',
  'Wall and ceiling linings - paint finish generally poor throughout',
  'Ceiling linings - hairline cracks evident to plasterboard joints',
  'Wall linings - hairline cracks evident at door heads',
  'Wet areas - silicone/caulking deteriorated',
  'Wet areas - mould evident to shower enclosure',
  'Wet areas - grout to floor tiles deteriorated',
  'Wet areas - cracked/broken floor tiles evident',
  'Wet areas - moisture damage to walls and ceilings due to poor ventilation',
  'Kitchen - silicone/caulking deteriorated',
  'Skirting and architraves - hairline cracks evident',
  'Doors - in poor condition generally throughout',
  'Cabinetry - in poor condition generally throughout',
  'Floor coverings - in poor condition generally throughout',
  'Plumbing fittings and fitments - in poor condition generally throughout',
  'Plumbing fittings - signs of water leaks to underside of sinks evident',
  'Roof space - insulation untidy and not tight between bottom chord of trusses',
] as const;

export const STRUCTURAL_MOVEMENT = ['Walls', 'Foundation', 'Retaining Wall', 'Floor', 'Roof Structure'] as const;

export const DEFORMATION_ITEMS = [
  'Roof Deformation / Sagging',
  'Ceiling Deformation / Sagging',
  'Wall Bowing',
  'Floor Deflection',
] as const;

export const MOISTURE_SOURCES = ['Rising Damp', 'Plumbing Leak', 'Roof Leak'] as const;

export const BUILDING_CONDITIONS_CONDUCIVE = [
  'Water pooling adjacent to building',
  'Poor surface drainage',
  'Inadequate fall away from building',
  'Garden beds against external walls',
  'Timber in ground contact',
  'DPC below ground level or not visible',
  'Downpipe discharge against building',
  'Subfloor moisture / poor drainage',
] as const;

export const BUILDING_MAJOR_SAFETY_HAZARDS = [
  'Friable Asbestos Suspected',
  'Electrical Hazard',
  'Exposed electrical components',
  'Structural Hazard',
  'Trip Hazard',
  'Loose balustrades',
  'Unsafe handrails',
  'Damaged stairs',
  'Aggressive dog / dangerous animal',
  'Aggressive or hostile client',
  'Other',
] as const;

export const FINISH_ELEMENT_DAMAGE_OPTIONS = [
  'Skirting',
  'Carpet',
  'Plasterboard',
  'Door',
  'Door jamb',
  'Architrave',
  'Cornice',
  'Floorboards',
  'Tiling',
  'Window sill',
  'Ceiling lining',
  'Other',
] as const;

export const CRACK_WIDTH_OPTIONS = [
  '< 1 mm',
  '1-2 mm',
  '2-5 mm',
  '5-15 mm',
  '> 15 mm',
  'Undetermined',
] as const;

export const CONCLUSION_RATINGS = [
  'Low',
  'Below Average',
  'Average',
  'Above Average',
  'High',
] as const;

export const OVERALL_BUILDING_CONDITION = [
  'Excellent',
  'Good',
  'Average',
  'Below Average',
  'Poor',
] as const;

export const OVERALL_COMPARISON = [
  'Well Above Average',
  'Above Average',
  'Average',
  'Below Average',
  'Well Below Average',
] as const;

export const BUILDING_REPORT_TYPES = [
  'Pre-Purchase Building Inspection Report – Residential',
  'Pre-Purchase Building Inspection Report – Commercial',
  'Pre-Sale Building Inspection Report – Residential',
  'Pre-Sale Building Inspection Report – Commercial',
  'Building Inspection Report – Residential',
  'Building Inspection Report – Commercial',
  'Defect Inspection Report',
  'Maintenance Building Inspection Report',
] as const;

export const DEFAULT_BUILDING_REPORT_TYPE = BUILDING_REPORT_TYPES[0];

export function buildingReportTypeSelectOptions(
  currentValue?: string,
): { value: string; label: string }[] {
  const current = currentValue?.trim();
  const known = new Set<string>(BUILDING_REPORT_TYPES);
  const options = BUILDING_REPORT_TYPES.map((value) => ({ value, label: value }));
  if (current && !known.has(current)) {
    options.unshift({ value: current, label: current });
  }
  return options;
}

export const PEST_REPORT_TYPES = [
  'Timber and Pest Inspection',
  'Timber Pest Inspection',
] as const;

export const DEFAULT_PEST_REPORT_TYPE = PEST_REPORT_TYPES[0];

export const QUALITY_OF_WORKMANSHIP_RATINGS = OVERALL_BUILDING_CONDITION;

export const RECOMMENDATION_PRESETS = [
  'Licensed Plumber Recommended',
  'Licensed Roof Plumber Recommended',
  'Structural Engineer Recommended',
  'Licensed Electrician Recommended',
  'Waterproofing Contractor Recommended',
  'Drainage Improvements Recommended',
] as const;

export const FLOOR_TYPES = ['Carpet', 'Timber', 'Tiles', 'Vinyl'] as const;

export const LAUNDRY_FLOOR_TYPES = ['Tiles', 'Vinyl', 'Concrete', 'Timber', 'Other'] as const;

export const FLOOR_CONDITION = ['Good', 'Fair', 'Poor', 'Damaged', 'Stained'] as const;

export const SPLASHBACK_CONDITION = ['Good', 'Fair', 'Poor', 'Cracked', 'Loose', 'Missing', 'Not Present'] as const;

/** Fixture / joinery condition including not-present and undetermined states. */
export const FIXTURE_CONDITION = [
  'N/A',
  'Good',
  'Fair',
  'Poor',
  'Damaged',
  'Broken',
  'Not Present',
  'Undetermined',
] as const;

export const ELECTRICAL_POINT_STATUS = [
  'Working',
  'Not Working',
  'Damaged',
  'Undetermined',
  'Should be inspected by a licensed electrician',
] as const;

/** Default when lights or power points are not individually assessed. */
export const ELECTRICAL_WORKING = 'Working' as const;

/** Default for switches and smoke alarms — not tested during building inspection. */
export const LICENSED_ELECTRICIAN_INSPECTION = 'Should be inspected by a licensed electrician' as const;

export const LIGHTS_SWITCHES_STATUS = [
  'Working',
  'Not Working',
  'Undetermined',
  'Should be inspected by a licensed electrician',
] as const;

export const SMOKE_ALARM_STATUS = [
  'Present',
  'Not Present',
  'Unable to Test',
  'Undetermined',
  'Should be inspected by a licensed electrician',
] as const;

export const KITCHEN_DISCLAIMERS = [
  'Kitchen appliances should be inspected by a licensed electrician.',
  'Testing or assessing electrical appliances is not included as part of this building inspection.',
] as const;

export const LAUNDRY_DISCLAIMERS = [
  'Laundry appliances should be inspected by a licensed electrician.',
  'Testing or assessing electrical appliances is not included as part of this building inspection.',
] as const;

export const GENERAL_ELECTRICAL_DISCLAIMERS = [
  'Any power points, electrical switches, electrical wiring, or electrical equipment are not tested during this inspection.',
  'A licensed electrician should inspect all electrical installations and appliances if required.',
] as const;

export const WALL_DEFECTS = [
  'Cracking',
  'Moisture Damage',
  'Hole/Damage',
  'Staining',
  'No Visible Defects',
] as const;

export const MOISTURE_LEVELS = ['None', 'Minor', 'Moderate', 'Major'] as const;
