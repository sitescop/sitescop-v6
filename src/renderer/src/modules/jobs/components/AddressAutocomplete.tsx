import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Loader2, MapPin, WifiOff } from 'lucide-react';
import { cn } from '@/lib/cn';
import { searchAddressSuggestions, type AddressSuggestion } from '@/lib/address-search';

interface AddressAutocompleteProps {
  label?: string;
  streetValue: string;
  suburbValue: string;
  onStreetChange: (value: string) => void;
  onSuburbChange: (value: string) => void;
  onAddressSelected?: (suggestion: AddressSuggestion) => void;
  placeholder?: string;
  required?: boolean;
  error?: string;
}

interface DropdownRect {
  top: number;
  left: number;
  width: number;
  maxHeight: number;
  openUp: boolean;
}

export function AddressAutocomplete({
  label = 'Street address *',
  streetValue,
  suburbValue,
  onStreetChange,
  onSuburbChange,
  onAddressSelected,
  placeholder = 'Start typing address — e.g. 14 Banksia Paddington',
  required,
  error,
}: AddressAutocompleteProps) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const selectedStreetRef = useRef<string | null>(null);
  const requestIdRef = useRef(0);

  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [offline, setOffline] = useState(false);
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const [dropdownRect, setDropdownRect] = useState<DropdownRect | null>(null);

  function updateDropdownPosition() {
    const input = inputRef.current;
    if (!input) return;

    const rect = input.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom - 16;
    const spaceAbove = rect.top - 16;
    const openUp = spaceBelow < 220 && spaceAbove > spaceBelow;
    const maxHeight = Math.min(280, openUp ? spaceAbove : spaceBelow);

    setDropdownRect({
      top: openUp ? rect.top - 4 : rect.bottom + 4,
      left: rect.left,
      width: rect.width,
      maxHeight: Math.max(120, maxHeight),
      openUp,
    });
  }

  useLayoutEffect(() => {
    if (!open || suggestions.length === 0) {
      setDropdownRect(null);
      return;
    }
    updateDropdownPosition();

    window.addEventListener('scroll', updateDropdownPosition, true);
    window.addEventListener('resize', updateDropdownPosition);
    return () => {
      window.removeEventListener('scroll', updateDropdownPosition, true);
      window.removeEventListener('resize', updateDropdownPosition);
    };
  }, [open, suggestions.length]);

  useEffect(() => {
    const trimmed = streetValue.trim();

    if (selectedStreetRef.current && trimmed === selectedStreetRef.current) {
      setSuggestions([]);
      setOpen(false);
      setLoading(false);
      setOffline(false);
      return;
    }

    selectedStreetRef.current = null;

    if (trimmed.length < 3) {
      setSuggestions([]);
      setOpen(false);
      setLoading(false);
      setOffline(false);
      return;
    }

    setLoading(true);
    setOffline(false);
    const requestId = ++requestIdRef.current;

    const timer = window.setTimeout(() => {
      void searchAddressSuggestions(trimmed)
        .then((results) => {
          if (requestId !== requestIdRef.current) return;
          setSuggestions(results);
          setOpen(results.length > 0);
          setHighlightIndex(results.length > 0 ? 0 : -1);
          setOffline(results.length === 0 && navigator.onLine === false);
        })
        .catch(() => {
          if (requestId !== requestIdRef.current) return;
          setSuggestions([]);
          setOpen(false);
          setOffline(true);
        })
        .finally(() => {
          if (requestId === requestIdRef.current) setLoading(false);
        });
    }, 300);

    return () => window.clearTimeout(timer);
  }, [streetValue]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (!rootRef.current?.contains(target)) {
        const portal = document.getElementById(`address-list-${listId}`);
        if (portal?.contains(target)) return;
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [listId]);

  function selectSuggestion(suggestion: AddressSuggestion) {
    selectedStreetRef.current = suggestion.streetAddress.trim();
    onStreetChange(suggestion.streetAddress);
    if (suggestion.suburbLine) {
      onSuburbChange(suggestion.suburbLine);
    }
    onAddressSelected?.(suggestion);
    setOpen(false);
    setSuggestions([]);
    setHighlightIndex(-1);
    inputRef.current?.blur();
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && open && suggestions.length > 0) {
      e.preventDefault();
      e.stopPropagation();
      const index = highlightIndex >= 0 ? highlightIndex : 0;
      selectSuggestion(suggestions[index]);
      return;
    }

    if (!open || suggestions.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightIndex((i) => (i + 1) % suggestions.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightIndex((i) => (i <= 0 ? suggestions.length - 1 : i - 1));
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  }

  const inputId = label.toLowerCase().replace(/\s+/g, '-');

  const dropdown =
    open && suggestions.length > 0 && dropdownRect
      ? createPortal(
          <ul
            id={`address-list-${listId}`}
            role="listbox"
            style={{
              position: 'fixed',
              top: dropdownRect.openUp ? undefined : dropdownRect.top,
              bottom: dropdownRect.openUp
                ? window.innerHeight - dropdownRect.top
                : undefined,
              left: dropdownRect.left,
              width: dropdownRect.width,
              maxHeight: dropdownRect.maxHeight,
            }}
            className="z-[200] overflow-auto rounded-sm border border-border bg-surface py-1 shadow-elevated"
          >
            {suggestions.map((suggestion, index) => (
              <li key={suggestion.id} role="option" aria-selected={index === highlightIndex}>
                <button
                  type="button"
                  className={cn(
                    'flex w-full items-start gap-2 px-3 py-2.5 text-left text-sm transition-colors hover:bg-background',
                    index === highlightIndex && 'bg-primary/10',
                  )}
                  onMouseEnter={() => setHighlightIndex(index)}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    selectSuggestion(suggestion);
                  }}
                >
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <span>
                    <span className="block font-medium text-text">{suggestion.streetAddress}</span>
                    {suggestion.suburbLine ? (
                      <span className="block text-xs text-text-light">{suggestion.suburbLine}</span>
                    ) : (
                      <span className="block text-xs text-text-muted">Suburb not found — edit below</span>
                    )}
                  </span>
                </button>
              </li>
            ))}
          </ul>,
          document.body,
        )
      : null;

  return (
    <div ref={rootRef} className="relative">
      <label htmlFor={inputId} className="mb-1.5 block text-sm font-medium text-text">
        {label}
      </label>
      <div className="relative">
        <input
          ref={inputRef}
          id={inputId}
          type="text"
          autoComplete="off"
          role="combobox"
          aria-expanded={open}
          aria-controls={`address-list-${listId}`}
          aria-autocomplete="list"
          value={streetValue}
          required={required}
          placeholder={placeholder}
          onChange={(e) => {
            selectedStreetRef.current = null;
            onStreetChange(e.target.value);
          }}
          onFocus={() => {
            if (suggestions.length > 0) setOpen(true);
          }}
          onKeyDown={handleKeyDown}
          className={cn(
            'w-full rounded-sm border border-border bg-surface py-2.5 pl-3 pr-10 text-sm text-text transition-colors placeholder:text-text-muted focus:border-primary focus:ring-2 focus:ring-primary/20',
            error && 'border-danger',
          )}
        />
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-text-muted">
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <MapPin className="h-4 w-4" />
          )}
        </span>
      </div>

      {error && <p className="mt-1 text-sm text-danger">{error}</p>}

      {!error &&
        streetValue.trim().length >= 3 &&
        !loading &&
        suggestions.length === 0 &&
        !offline &&
        !selectedStreetRef.current && (
          <p className="mt-1 text-xs text-text-muted">
            No matches — type the full street address and suburb below.
          </p>
        )}

      {offline && (
        <p className="mt-1 flex items-center gap-1 text-xs text-warning">
          <WifiOff className="h-3.5 w-3.5" />
          Address suggestions need internet. Type the full address manually.
        </p>
      )}

      {dropdown}

      {suburbValue && (
        <p className="mt-1 text-xs text-text-light">
          Selected suburb: <span className="font-medium text-text">{suburbValue}</span>
        </p>
      )}
    </div>
  );
}
