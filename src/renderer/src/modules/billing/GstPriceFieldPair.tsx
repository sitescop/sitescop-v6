import { Input } from '@/design-system/components';
import {
  exAudStringToIncAudString,
  incAudStringToExAudString,
} from '@shared/gst-pricing';

interface GstPriceFieldPairProps {
  exValue: string;
  incValue: string;
  onExChange: (ex: string, inc: string) => void;
  onIncChange: (ex: string, inc: string) => void;
  exLabel?: string;
  incLabel?: string;
  disabled?: boolean;
  required?: boolean;
}

export function GstPriceFieldPair({
  exValue,
  incValue,
  onExChange,
  onIncChange,
  exLabel = 'Price (ex GST, AUD)',
  incLabel = 'Price (inc GST, AUD)',
  disabled = false,
  required = false,
}: GstPriceFieldPairProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Input
        label={exLabel}
        type="number"
        min="0"
        step="0.01"
        value={exValue}
        disabled={disabled}
        required={required}
        onChange={(e) => {
          const ex = e.target.value;
          onExChange(ex, exAudStringToIncAudString(ex));
        }}
      />
      <Input
        label={incLabel}
        type="number"
        min="0"
        step="0.01"
        value={incValue}
        disabled={disabled}
        required={required}
        onChange={(e) => {
          const inc = e.target.value;
          onIncChange(incAudStringToExAudString(inc), inc);
        }}
      />
    </div>
  );
}
