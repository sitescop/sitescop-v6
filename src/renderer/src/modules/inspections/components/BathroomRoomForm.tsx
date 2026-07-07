import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { BathroomRoomData, CheckboxFieldState } from '@sitescop/room-engine-core';
import {
  BATHROOM_DOOR_STATUS,
  BATHROOM_FIXTURES,
  BATHROOM_FLOOR_TILE_STATUS,
  BATHROOM_GROUT_CONDITION,
  BATHROOM_JAMB_STATUS,
  BATHROOM_TYPES,
  BATHROOM_WALL_TILE_STATUS,
  BATHROOM_WATER_POOLING_CAUSES,
  FIXTURE_CONDITION,
  LICENSED_ELECTRICIAN_INSPECTION,
  MOISTURE_LEVELS,
  normalizeCheckboxField,
} from '@sitescop/room-engine-core';
import { Select } from '@/design-system/components';
import {
  CheckboxGroupField,
  InspectionSubsectionHeading,
  PhotoField,
  RatingSelect,
  SectionComments,
  YesNoSelect,
} from './InspectionFields';

interface BathroomRoomFormProps {
  data: BathroomRoomData;
  onPatch: (partial: Partial<BathroomRoomData>) => void;
  disabled?: boolean;
}

function fixtureIsSelected(fixtures: CheckboxFieldState, name: string): boolean {
  return fixtures.selected.includes(name) || fixtures.custom.includes(name);
}

function hasAnyFixture(fixtures: CheckboxFieldState): boolean {
  const normalized = normalizeCheckboxField(fixtures);
  return normalized.selected.length > 0 || normalized.custom.length > 0;
}

function FixtureSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-4 rounded-sm border border-primary/20 bg-primary/5 p-4">
      <InspectionSubsectionHeading as="h4">{title}</InspectionSubsectionHeading>
      <div className="grid gap-4 md:grid-cols-2">{children}</div>
    </section>
  );
}

function groutConditionValue(missing: string, deteriorated: string): string {
  if (missing === 'Yes') return 'Missing';
  if (deteriorated === 'Yes') return 'Deteriorated';
  return 'Good';
}

function floorTileSelectValue(data: BathroomRoomData): string {
  if (data.floorTilesBrokenCracked === 'Yes') return 'Broken/Cracked';
  if (data.floorTilesLoose === 'Yes') return 'Loose';
  if (data.floorTilesHollowSounding === 'Yes') return 'Hollow Sounding';
  return data.floorTilesCondition || 'Good';
}

function wallTileSelectValue(data: BathroomRoomData): string {
  if (data.wallTilesBrokenCracked === 'Yes') return 'Broken/Cracked';
  if (data.wallTilesLoose === 'Yes') return 'Loose';
  if (data.wallTilesHollowSounding === 'Yes') return 'Hollow Sounding';
  return data.wallTilesCondition || 'Good';
}

function doorStatusValue(data: BathroomRoomData): string {
  if (data.doorMoistureDamage === 'Yes') return 'Moisture Damage';
  if (data.doorOperating === 'No') return 'Not Operating';
  return data.doorCondition || 'Good';
}

function jambStatusValue(data: BathroomRoomData): string {
  if (data.doorJambMoistureDamage === 'Yes') return 'Moisture Damage';
  return data.doorJambCondition || 'Good';
}

export function BathroomRoomForm({ data, onPatch, disabled = false }: BathroomRoomFormProps) {
  const fixturesKey = useMemo(
    () => JSON.stringify(normalizeCheckboxField(data.fixtures)),
    [data.fixtures],
  );
  const [fixtures, setFixtures] = useState(() => normalizeCheckboxField(data.fixtures));

  useEffect(() => {
    setFixtures(normalizeCheckboxField(data.fixtures));
  }, [fixturesKey, data.fixtures]);

  const set = <K extends keyof BathroomRoomData>(key: K, value: BathroomRoomData[K]) => {
    onPatch({ [key]: value } as Partial<BathroomRoomData>);
  };

  const handleFixturesChange = useCallback(
    (value: CheckboxFieldState) => {
      setFixtures(value);
      onPatch({ fixtures: value });
    },
    [onPatch],
  );

  const showBasin = fixtureIsSelected(fixtures, 'Basin') || fixtureIsSelected(fixtures, 'Vanity Cabinet');
  const showShower =
    fixtureIsSelected(fixtures, 'Shower Base / Shower Tray') ||
    fixtureIsSelected(fixtures, 'Shower Head') ||
    fixtureIsSelected(fixtures, 'Shower Screen');
  const showGeneral = hasAnyFixture(fixtures);

  const patchFloorTile = (value: string) => {
    if (value === 'Broken/Cracked') {
      onPatch({ floorTilesCondition: 'Damaged', floorTilesBrokenCracked: 'Yes', floorTilesLoose: 'No', floorTilesHollowSounding: 'No' });
    } else if (value === 'Loose') {
      onPatch({ floorTilesCondition: 'Damaged', floorTilesBrokenCracked: 'No', floorTilesLoose: 'Yes', floorTilesHollowSounding: 'No' });
    } else if (value === 'Hollow Sounding') {
      onPatch({ floorTilesCondition: 'Fair', floorTilesBrokenCracked: 'No', floorTilesLoose: 'No', floorTilesHollowSounding: 'Yes' });
    } else {
      onPatch({ floorTilesCondition: value, floorTilesBrokenCracked: 'No', floorTilesLoose: 'No', floorTilesHollowSounding: 'No' });
    }
  };

  const patchWallTile = (value: string) => {
    if (value === 'Broken/Cracked') {
      onPatch({ wallTilesCondition: 'Damaged', wallTilesBrokenCracked: 'Yes', wallTilesLoose: 'No', wallTilesHollowSounding: 'No' });
    } else if (value === 'Loose') {
      onPatch({ wallTilesCondition: 'Damaged', wallTilesBrokenCracked: 'No', wallTilesLoose: 'Yes', wallTilesHollowSounding: 'No' });
    } else if (value === 'Hollow Sounding') {
      onPatch({ wallTilesCondition: 'Fair', wallTilesBrokenCracked: 'No', wallTilesLoose: 'No', wallTilesHollowSounding: 'Yes' });
    } else {
      onPatch({ wallTilesCondition: value, wallTilesBrokenCracked: 'No', wallTilesLoose: 'No', wallTilesHollowSounding: 'No' });
    }
  };

  return (
    <div className="space-y-4 rounded-sm border border-border bg-background p-4">
      <div className="grid gap-4 md:grid-cols-2">
        <Select
          label="Bathroom Type"
          value={data.bathroomType}
          onChange={(e) => set('bathroomType', e.target.value)}
          options={BATHROOM_TYPES.map((v) => ({ value: v, label: v }))}
        />
      </div>

      <CheckboxGroupField
        disabled={disabled}
        label="Fixtures Present (only selected sections appear below)"
        options={BATHROOM_FIXTURES}
        value={fixtures}
        onChange={handleFixturesChange}
      />

      <div className="space-y-4">
        {showBasin && (
          <FixtureSection title="Basin & Vanity">
            <RatingSelect disabled={disabled} label="Basin Type" value={data.basinType} onChange={(v) => set('basinType', v)} options={['Single', 'Double']} />
            <RatingSelect disabled={disabled} label="Drainage" value={data.basinDrainage} onChange={(v) => set('basinDrainage', v)} options={['Not Blocked', 'Partially Blocked', 'Blocked']} />
            <YesNoSelect disabled={disabled} label="Leak Inside Cabinet" value={data.basinLeakInsideCabinet} onChange={(v) => set('basinLeakInsideCabinet', v)} />
            <RatingSelect disabled={disabled} label="Basin Condition" value={data.basinCondition} onChange={(v) => set('basinCondition', v)} options={['Good', 'Fair', 'Poor', 'Damaged']} />
          </FixtureSection>
        )}

        {fixtureIsSelected(fixtures, 'Toilet') && (
          <FixtureSection title="Toilet">
            <YesNoSelect disabled={disabled} label="Flush Working" value={data.toiletFlushWorking} onChange={(v) => set('toiletFlushWorking', v)} />
            <RatingSelect disabled={disabled} label="Blockage" value={data.toiletBlockage} onChange={(v) => set('toiletBlockage', v)} options={['No', 'Partially Blocked', 'Blocked']} />
            <YesNoSelect disabled={disabled} label="Leakage Detected" value={data.toiletLeakage} onChange={(v) => set('toiletLeakage', v)} />
            <YesNoSelect disabled={disabled} label="Secure & Stable" value={data.toiletSecureStable} onChange={(v) => set('toiletSecureStable', v)} />
            <YesNoSelect disabled={disabled} label="Toilet Cracks Damage" value={data.toiletCracksDamage || 'No'} onChange={(v) => set('toiletCracksDamage', v)} />
            <RatingSelect disabled={disabled} label="Toilet Seat Condition" value={data.toiletSeatCondition} onChange={(v) => set('toiletSeatCondition', v)} options={['Good', 'Fair', 'Poor', 'Broken']} />
          </FixtureSection>
        )}

        {fixtureIsSelected(fixtures, 'Taps & Mixers') && (
          <FixtureSection title="Taps & Mixers">
            <YesNoSelect disabled={disabled} label="Operating Correctly" value={data.tapsOperating} onChange={(v) => set('tapsOperating', v)} />
            <YesNoSelect disabled={disabled} label="Dripping" value={data.tapsDripping} onChange={(v) => set('tapsDripping', v)} />
            <YesNoSelect disabled={disabled} label="Active Leak" value={data.tapsActiveLeak} onChange={(v) => set('tapsActiveLeak', v)} />
            <RatingSelect disabled={disabled} label="Condition" value={data.tapsCondition} onChange={(v) => set('tapsCondition', v)} options={['Good', 'Fair', 'Poor']} />
          </FixtureSection>
        )}

        {fixtureIsSelected(fixtures, 'Shower Base / Shower Tray') && (
          <FixtureSection title="Shower Base / Shower Tray">
            <YesNoSelect disabled={disabled} label="Shower Head Leaking" value={data.showerHeadLeaking} onChange={(v) => set('showerHeadLeaking', v)} />
            <YesNoSelect disabled={disabled} label="Evidence of Leakage" value={data.showerEvidenceOfLeakage} onChange={(v) => set('showerEvidenceOfLeakage', v)} />
          </FixtureSection>
        )}

        {fixtureIsSelected(fixtures, 'Shower Head') && (
          <FixtureSection title="Shower Head">
            <YesNoSelect disabled={disabled} label="Shower Head Leaking" value={data.showerHeadLeaking} onChange={(v) => set('showerHeadLeaking', v)} />
          </FixtureSection>
        )}

        {fixtureIsSelected(fixtures, 'Shower Screen') && (
          <FixtureSection title="Shower Screen">
            <RatingSelect disabled={disabled} label="Condition" value={data.screenCondition} onChange={(v) => set('screenCondition', v)} options={['Good', 'Fair', 'Poor']} />
            <YesNoSelect disabled={disabled} label="Water Escaping" value={data.screenWaterEscaping} onChange={(v) => set('screenWaterEscaping', v)} />
            <YesNoSelect disabled={disabled} label="Damage/Cracks" value={data.screenDamageCracks} onChange={(v) => set('screenDamageCracks', v)} />
          </FixtureSection>
        )}

        {fixtureIsSelected(fixtures, 'Exhaust Fan') && (
          <FixtureSection title="Exhaust Fan">
            <YesNoSelect disabled={disabled} label="Exhaust Fan Working" value={data.exhaustFanWorking} onChange={(v) => set('exhaustFanWorking', v)} />
            <YesNoSelect disabled={disabled} label="Exhaust Fan Noise" value={data.exhaustFanNoise} onChange={(v) => set('exhaustFanNoise', v)} />
          </FixtureSection>
        )}

        {fixtureIsSelected(fixtures, 'Light Fittings') && (
          <FixtureSection title="Light Fittings">
            <YesNoSelect disabled={disabled} label="Lights Working" value={data.lightsWorking || 'Yes'} onChange={(v) => set('lightsWorking', v)} />
          </FixtureSection>
        )}

        {fixtureIsSelected(fixtures, 'Power Points') && (
          <div className="space-y-2 rounded-sm border border-border bg-background p-4 text-sm text-text-muted">
            <InspectionSubsectionHeading className="mb-2 border-b-0 pb-0">Switches</InspectionSubsectionHeading>
            <p>{LICENSED_ELECTRICIAN_INSPECTION}</p>
          </div>
        )}
      </div>

      {showGeneral && (
        <section className="space-y-4 rounded-sm border border-border p-4">
          <InspectionSubsectionHeading as="h4">General Bathroom Condition</InspectionSubsectionHeading>
          <div className="grid gap-4 md:grid-cols-2">
            <RatingSelect
              disabled={disabled}
              label="Floor Tiles"
              value={floorTileSelectValue(data)}
              onChange={patchFloorTile}
              options={[...BATHROOM_FLOOR_TILE_STATUS]}
            />
            <RatingSelect
              disabled={disabled}
              label="Wall Tiles"
              value={wallTileSelectValue(data)}
              onChange={patchWallTile}
              options={[...BATHROOM_WALL_TILE_STATUS]}
            />
            <RatingSelect
              disabled={disabled}
              label="Grout"
              value={groutConditionValue(data.groutMissing, data.groutDeteriorated)}
              onChange={(v) =>
                onPatch({
                  groutMissing: v === 'Missing' ? 'Yes' : 'No',
                  groutDeteriorated: v === 'Deteriorated' ? 'Yes' : 'No',
                })
              }
              options={[...BATHROOM_GROUT_CONDITION]}
            />
          </div>

          <div className="space-y-4 rounded-sm border border-border bg-background p-4">
            <InspectionSubsectionHeading as="h5" className="mb-0 border-b-0 pb-0">
              Water Pooling
            </InspectionSubsectionHeading>
            <YesNoSelect
              disabled={disabled}
              label="Water Pooling Present"
              value={data.waterPoolingPresent || 'No'}
              onChange={(v) => set('waterPoolingPresent', v)}
            />
            {data.waterPoolingPresent === 'Yes' && (
              <>
                <CheckboxGroupField
                  disabled={disabled}
                  label="If Yes"
                  options={BATHROOM_WATER_POOLING_CAUSES}
                  value={data.waterPoolingCause}
                  onChange={(v) => set('waterPoolingCause', v)}
                  allowCustom={false}
                />
                <PhotoField
                  disabled={disabled}
                  label="Photo Evidence"
                  photos={data.waterPoolingPhotos}
                  onChange={(v) => set('waterPoolingPhotos', v)}
                />
              </>
            )}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {showShower && (
              <>
                <YesNoSelect
                  disabled={disabled}
                  label="Shower Operating"
                  value={data.showerOperating || 'Yes'}
                  onChange={(v) => set('showerOperating', v)}
                />
                <RatingSelect
                  disabled={disabled}
                  label="Shower Drainage"
                  value={data.showerDrainage || 'Not Blocked'}
                  onChange={(v) => set('showerDrainage', v)}
                  options={['Not Blocked', 'Partially Blocked', 'Blocked']}
                />
              </>
            )}
            <RatingSelect
              disabled={disabled}
              label="Door"
              value={doorStatusValue(data)}
              onChange={(v) => {
                if (v === 'Moisture Damage') {
                  onPatch({ doorMoistureDamage: 'Yes', doorOperating: 'Yes', doorCondition: 'Poor' });
                } else if (v === 'Not Operating') {
                  onPatch({ doorMoistureDamage: 'No', doorOperating: 'No', doorCondition: data.doorCondition || 'Fair' });
                } else {
                  onPatch({ doorMoistureDamage: 'No', doorOperating: 'Yes', doorCondition: v });
                }
              }}
              options={[...BATHROOM_DOOR_STATUS]}
            />
            <RatingSelect
              disabled={disabled}
              label="Door Jamb"
              value={jambStatusValue(data)}
              onChange={(v) => {
                if (v === 'Moisture Damage') {
                  onPatch({ doorJambMoistureDamage: 'Yes', doorJambCondition: 'Poor' });
                } else {
                  onPatch({ doorJambMoistureDamage: 'No', doorJambCondition: v });
                }
              }}
              options={[...BATHROOM_JAMB_STATUS]}
            />
            <RatingSelect
              disabled={disabled}
              label="Window"
              value={data.windowCondition || 'Good'}
              onChange={(v) => set('windowCondition', v)}
              options={[...FIXTURE_CONDITION]}
            />
            <RatingSelect
              disabled={disabled}
              label="Window Operating"
              value={data.windowOperating || 'Good'}
              onChange={(v) => set('windowOperating', v)}
              options={[...FIXTURE_CONDITION]}
            />
            <RatingSelect disabled={disabled} label="Silicone Condition" value={data.siliconeCondition || 'Good'} onChange={(v) => set('siliconeCondition', v)} options={['Good', 'Fair', 'Poor']} />
            <YesNoSelect disabled={disabled} label="Silicone Failed/Missing" value={data.siliconeFailedMissing} onChange={(v) => set('siliconeFailedMissing', v)} />
            <YesNoSelect disabled={disabled} label="Mould Present" value={data.siliconeMouldPresent} onChange={(v) => set('siliconeMouldPresent', v)} />
            <YesNoSelect disabled={disabled} label="Water Escaping Observed" value={data.waterEscapingObserved} onChange={(v) => set('waterEscapingObserved', v)} />
            <RatingSelect disabled={disabled} label="Moisture Damage" value={data.moistureDamage || 'None'} onChange={(v) => set('moistureDamage', v)} options={[...MOISTURE_LEVELS]} />
          </div>
        </section>
      )}

      {showGeneral && data.waterEscapingObserved === 'Yes' && (
        <PhotoField disabled={disabled} label="Water Escaping Photo Evidence" photos={data.waterEscapingPhotos} onChange={(v) => set('waterEscapingPhotos', v)} />
      )}

      {showGeneral && (
        <PhotoField disabled={disabled} label="Moisture Evidence (Meter / Thermal)" photos={data.moistureEvidencePhotos} onChange={(v) => set('moistureEvidencePhotos', v)} />
      )}

      <SectionComments
        disabled={disabled}
        comments={data.comments}
        photos={data.photos}
        onCommentsChange={(v) => set('comments', v)}
        onPhotosChange={(v) => set('photos', v)}
      />
    </div>
  );
}
