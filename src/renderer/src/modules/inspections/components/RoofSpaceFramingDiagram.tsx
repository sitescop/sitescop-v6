import { useMemo, useState } from 'react';
import {
  ROOF_FRAMING_DEFECT_CONDITIONS,
  ROOF_FRAMING_ELEMENTS,
  ROOF_FRAMING_TRADE_RECOMMENDATIONS,
  normalizeCheckboxField,
  type CheckboxFieldState,
} from '@sitescop/room-engine-core';
import { Button, Modal } from '@/design-system/components';
import { cn } from '@/lib/cn';
import { InspectionSubsectionHeading } from './InspectionFields';

type RoofFramingElement = (typeof ROOF_FRAMING_ELEMENTS)[number];

interface Hotspot {
  id: RoofFramingElement;
  /** Timber member path drawn as a thick beam */
  d: string;
  labelX: number;
  labelY: number;
}

/** Realistic pitched-roof timber framing cross-section hotspots. */
const HOTSPOTS: Hotspot[] = [
  {
    id: 'Ridge board',
    d: 'M 292 42 L 308 42 L 308 78 L 292 78 Z',
    labelX: 300,
    labelY: 30,
  },
  {
    id: 'Rafter',
    // Right-hand common rafter (thick timber)
    d: 'M 300 55 L 528 278 L 512 292 L 300 78 Z',
    labelX: 455,
    labelY: 145,
  },
  {
    id: 'Collar tie',
    d: 'M 205 128 L 395 128 L 395 146 L 205 146 Z',
    labelX: 300,
    labelY: 116,
  },
  {
    id: 'Purlin',
    d: 'M 388 168 L 498 168 L 498 188 L 388 188 Z',
    labelX: 443,
    labelY: 158,
  },
  {
    id: 'Under-purlin',
    d: 'M 360 198 L 478 198 L 478 218 L 360 218 Z',
    labelX: 419,
    labelY: 188,
  },
  {
    id: 'Strut',
    d: 'M 408 218 L 426 218 L 426 278 L 408 278 Z',
    labelX: 448,
    labelY: 252,
  },
  {
    id: 'Hanging beam',
    d: 'M 230 248 L 370 248 L 370 268 L 230 268 Z',
    labelX: 300,
    labelY: 238,
  },
  {
    id: 'Ceiling joist',
    d: 'M 95 288 L 505 288 L 505 308 L 95 308 Z',
    labelX: 300,
    labelY: 328,
  },
  {
    id: 'Wall plate',
    d: 'M 78 308 L 128 308 L 128 328 L 78 328 Z',
    labelX: 103,
    labelY: 348,
  },
];

interface RoofSpaceFramingDiagramProps {
  value: CheckboxFieldState;
  disabled?: boolean;
  onApplyFinding: (element: RoofFramingElement, defects: string[], trades: string[]) => void;
  onClearFinding?: (element: RoofFramingElement) => void;
}

function toggleInList(list: string[], item: string): string[] {
  return list.includes(item) ? list.filter((entry) => entry !== item) : [...list, item];
}

export function RoofSpaceFramingDiagram({
  value,
  disabled = false,
  onApplyFinding,
  onClearFinding,
}: RoofSpaceFramingDiagramProps) {
  const selected = useMemo(() => new Set(normalizeCheckboxField(value).selected), [value]);
  const [activeElement, setActiveElement] = useState<RoofFramingElement | null>(null);
  const [defects, setDefects] = useState<string[]>([]);
  const [trades, setTrades] = useState<string[]>([]);

  const openPicker = (element: RoofFramingElement) => {
    if (disabled) return;
    setActiveElement(element);
    setDefects([]);
    setTrades([]);
  };

  const closePicker = () => {
    setActiveElement(null);
    setDefects([]);
    setTrades([]);
  };

  const confirmFinding = () => {
    if (!activeElement) return;
    if (defects.length === 0 && trades.length === 0) return;
    onApplyFinding(activeElement, defects, trades);
    closePicker();
  };

  return (
    <div className="space-y-3">
      <InspectionSubsectionHeading>Roof framing diagram</InspectionSubsectionHeading>
      <p className="text-sm text-text-muted">
        Click a timber member, then select defect conditions and recommended trades to create the
        comment.
      </p>

      <div className="overflow-hidden rounded-lg border border-primary/20 bg-gradient-to-b from-[#F3E6D4] to-[#E8D5BC]">
        <svg
          viewBox="0 0 600 380"
          role="img"
          aria-label="Interactive timber roof framing diagram"
          className="h-auto w-full max-h-[460px]"
        >
          <defs>
            <linearGradient id="timberFill" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#C4A484" />
              <stop offset="50%" stopColor="#A67C52" />
              <stop offset="100%" stopColor="#8B5E3C" />
            </linearGradient>
            <linearGradient id="timberActive" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#0B4F8C" />
              <stop offset="100%" stopColor="#F39C12" />
            </linearGradient>
            <pattern id="grain" width="8" height="8" patternUnits="userSpaceOnUse">
              <path d="M0 4 H8" stroke="#7A5230" strokeWidth="0.6" opacity="0.25" />
            </pattern>
          </defs>

          {/* Attic void / open framing backdrop */}
          <path d="M 70 320 L 300 40 L 530 320 Z" fill="#F8F1E7" opacity="0.9" />

          {/* Left rafter (visual pair — click right rafter hotspot for Rafter) */}
          <path
            d="M 300 55 L 72 278 L 88 292 L 300 78 Z"
            fill="url(#timberFill)"
            stroke="#6B4423"
            strokeWidth="1.5"
            opacity="0.85"
          />
          <path d="M 300 55 L 72 278 L 88 292 L 300 78 Z" fill="url(#grain)" opacity="0.5" />

          {/* Ceiling plane / floor of roof space */}
          <rect x="70" y="318" width="460" height="18" fill="#D4B896" stroke="#6B4423" strokeWidth="1" />

          {/* Supporting wall stubs */}
          <rect x="70" y="336" width="28" height="28" fill="#B8956C" stroke="#6B4423" strokeWidth="1" />
          <rect x="502" y="336" width="28" height="28" fill="#B8956C" stroke="#6B4423" strokeWidth="1" />

          {HOTSPOTS.map((spot) => {
            const active = selected.has(spot.id);
            return (
              <g key={spot.id}>
                <path
                  d={spot.d}
                  fill={active ? 'url(#timberActive)' : 'url(#timberFill)'}
                  stroke={active ? '#F39C12' : '#5C3A21'}
                  strokeWidth={active ? 2.5 : 1.5}
                  className={cn(!disabled && 'cursor-pointer')}
                  onClick={() => openPicker(spot.id)}
                >
                  <title>{spot.id}</title>
                </path>
                <path d={spot.d} fill="url(#grain)" opacity={active ? 0.15 : 0.45} className="pointer-events-none" />
                <text
                  x={spot.labelX}
                  y={spot.labelY}
                  textAnchor="middle"
                  className="pointer-events-none select-none"
                  fill={active ? '#0B4F8C' : '#3F2A1A'}
                  fontSize="11"
                  fontWeight={700}
                >
                  {spot.id}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {ROOF_FRAMING_ELEMENTS.map((element) => {
          const active = selected.has(element);
          return (
            <button
              key={element}
              type="button"
              disabled={disabled}
              onClick={() => openPicker(element)}
              className={cn(
                'rounded-md border px-2.5 py-1 text-xs font-semibold transition-colors',
                active
                  ? 'border-[#F39C12] bg-[#0B4F8C] text-white'
                  : 'border-primary/20 bg-surface text-primary hover:border-primary/40',
                disabled && 'cursor-not-allowed opacity-60',
              )}
            >
              {element}
            </button>
          );
        })}
      </div>

      <Modal
        open={Boolean(activeElement)}
        onClose={closePicker}
        title={activeElement ? `${activeElement} — defect details` : 'Roof framing'}
        description="Select the conditions observed and which trades should be involved."
        size="md"
        footer={
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              {activeElement && selected.has(activeElement) && onClearFinding ? (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    onClearFinding(activeElement);
                    closePicker();
                  }}
                >
                  Clear this element
                </Button>
              ) : null}
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="secondary" onClick={closePicker}>
                Cancel
              </Button>
              <Button
                type="button"
                disabled={defects.length === 0 && trades.length === 0}
                onClick={confirmFinding}
              >
                Create comment
              </Button>
            </div>
          </div>
        }
      >
        <div className="space-y-5">
          <div>
            <p className="mb-2 text-sm font-semibold text-primary">Defect conditions</p>
            <div className="flex flex-wrap gap-2">
              {ROOF_FRAMING_DEFECT_CONDITIONS.map((item) => {
                const on = defects.includes(item);
                return (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setDefects((prev) => toggleInList(prev, item))}
                    className={cn(
                      'rounded-md border px-3 py-1.5 text-sm font-medium transition-colors',
                      on
                        ? 'border-[#DC2626] bg-[#FEF2F2] text-[#B91C1C]'
                        : 'border-border bg-surface text-text hover:border-primary/40',
                    )}
                  >
                    {item}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <p className="mb-2 text-sm font-semibold text-primary">Trades to involve</p>
            <div className="flex flex-wrap gap-2">
              {ROOF_FRAMING_TRADE_RECOMMENDATIONS.map((item) => {
                const on = trades.includes(item);
                return (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setTrades((prev) => toggleInList(prev, item))}
                    className={cn(
                      'rounded-md border px-3 py-1.5 text-sm font-medium transition-colors',
                      on
                        ? 'border-[#0B4F8C] bg-[#E8F1FA] text-[#0B4F8C]'
                        : 'border-border bg-surface text-text hover:border-primary/40',
                    )}
                  >
                    {item}
                  </button>
                );
              })}
            </div>
          </div>

          {activeElement && (defects.length > 0 || trades.length > 0) ? (
            <div className="rounded-md border border-primary/15 bg-secondary/[0.04] px-3 py-2 text-sm text-text">
              <p className="font-semibold text-primary">Preview</p>
              <p className="mt-1">
                Significant defect observed ({activeElement})
                {defects.length > 0 ? ` — ${defects.join('; ').toLowerCase()}.` : '.'}
                {trades.length > 0 ? ` Recommended: ${trades.join('; ')}.` : ''}
              </p>
            </div>
          ) : null}
        </div>
      </Modal>
    </div>
  );
}
