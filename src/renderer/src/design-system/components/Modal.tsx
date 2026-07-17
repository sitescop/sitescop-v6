import { type ReactNode, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Button } from './Button';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  /** Hide the title bar for more content height (keeps a close button). */
  hideHeader?: boolean;
}

const sizes = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-5xl',
  full: 'max-w-6xl h-[96vh] max-h-[96vh] flex flex-col',
};

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
  hideHeader = false,
}: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose]);

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div
      className={cn(
        'fixed inset-0 z-[100] flex items-end justify-center sm:items-center',
        size === 'full' ? 'p-2' : 'p-4',
      )}
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/50"
        aria-label="Close dialog"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={hideHeader || !title ? undefined : 'modal-title'}
        aria-label={hideHeader ? title || 'Dialog' : undefined}
        className={cn(
          'relative z-10 w-full rounded-xl border border-border bg-surface shadow-card',
          sizes[size],
        )}
      >
        {hideHeader ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            aria-label="Close"
            className="absolute right-2 top-2 z-20"
          >
            <X className="h-4 w-4" />
          </Button>
        ) : (
          <div className="flex shrink-0 items-start justify-between border-b border-border px-6 py-4">
            <div>
              <h2 id="modal-title" className="text-lg font-semibold text-text">
                {title}
              </h2>
              {description && <p className="mt-1 text-sm text-text-light">{description}</p>}
            </div>
            <Button variant="ghost" size="sm" onClick={onClose} aria-label="Close">
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}
        <div
          className={cn(
            'min-h-0 px-6 py-4',
            size === 'full' ? 'flex flex-1 flex-col overflow-hidden' : null,
            hideHeader && 'pt-3',
          )}
        >
          {children}
        </div>
        {footer && (
          <div className="flex shrink-0 justify-end gap-2 border-t border-border px-6 py-3">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
