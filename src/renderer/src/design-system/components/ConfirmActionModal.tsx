import type { ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, CircleDollarSign, Info, XCircle } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Button } from './Button';
import { Modal } from './Modal';

export type ConfirmActionTone = 'payment' | 'success' | 'warning' | 'danger' | 'info';

const TONE_STYLES: Record<
  ConfirmActionTone,
  {
    header: string;
    iconWrap: string;
    icon: typeof CircleDollarSign;
    iconClass: string;
    eyebrow: string;
    body: string;
    message: string;
    hint: string;
    confirmVariant: 'primary' | 'accent' | 'danger';
  }
> = {
  payment: {
    header: 'bg-gradient-to-r from-[#047857] to-[#10B981]',
    iconWrap: 'bg-[#ECFDF5]',
    icon: CircleDollarSign,
    iconClass: 'text-[#047857]',
    eyebrow: 'text-[#D1FAE5]',
    body: 'bg-[#ECFDF5]',
    message: 'text-[#065F46]',
    hint: 'text-[#047857]',
    confirmVariant: 'accent',
  },
  success: {
    header: 'bg-gradient-to-r from-[#047857] to-[#10B981]',
    iconWrap: 'bg-[#ECFDF5]',
    icon: CheckCircle2,
    iconClass: 'text-[#047857]',
    eyebrow: 'text-[#D1FAE5]',
    body: 'bg-[#ECFDF5]',
    message: 'text-[#065F46]',
    hint: 'text-[#047857]',
    confirmVariant: 'accent',
  },
  warning: {
    header: 'bg-gradient-to-r from-[#B45309] to-[#D97706]',
    iconWrap: 'bg-[#FEF3C7]',
    icon: AlertTriangle,
    iconClass: 'text-[#B45309]',
    eyebrow: 'text-[#FEF3C7]',
    body: 'bg-[#FFFBEB]',
    message: 'text-[#92400E]',
    hint: 'text-[#A16207]',
    confirmVariant: 'primary',
  },
  danger: {
    header: 'bg-gradient-to-r from-[#B91C1C] to-[#EF4444]',
    iconWrap: 'bg-[#FEE2E2]',
    icon: XCircle,
    iconClass: 'text-[#B91C1C]',
    eyebrow: 'text-[#FECACA]',
    body: 'bg-[#FEF2F2]',
    message: 'text-[#991B1B]',
    hint: 'text-[#B91C1C]',
    confirmVariant: 'danger',
  },
  info: {
    header: 'bg-gradient-to-r from-[#1D4ED8] to-[#3B82F6]',
    iconWrap: 'bg-[#DBEAFE]',
    icon: Info,
    iconClass: 'text-[#1D4ED8]',
    eyebrow: 'text-[#DBEAFE]',
    body: 'bg-[#EFF6FF]',
    message: 'text-[#1E3A8A]',
    hint: 'text-[#1D4ED8]',
    confirmVariant: 'primary',
  },
};

interface ConfirmActionModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  eyebrow?: string;
  message: ReactNode;
  hint?: ReactNode;
  tone?: ConfirmActionTone;
  confirmLabel?: string;
  cancelLabel?: string;
  /** When omitted, only a single dismiss button is shown (alert-style). */
  onConfirm?: () => void;
  isPending?: boolean;
  pendingLabel?: string;
}

export function ConfirmActionModal({
  open,
  onClose,
  title,
  eyebrow,
  message,
  hint,
  tone = 'payment',
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  onConfirm,
  isPending = false,
  pendingLabel = 'Working…',
}: ConfirmActionModalProps) {
  const style = TONE_STYLES[tone];
  const Icon = style.icon;
  const isAlertOnly = !onConfirm;

  return (
    <Modal open={open} onClose={onClose} size="sm" hideHeader>
      <div className="-mx-6 -mt-3 overflow-hidden rounded-t-xl">
        <div className={cn('px-6 py-5 text-center', style.header)}>
          <div
            className={cn(
              'mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-full shadow-md',
              style.iconWrap,
            )}
          >
            <Icon className={cn('h-8 w-8', style.iconClass)} aria-hidden />
          </div>
          <h2 className="text-lg font-bold text-white">{title}</h2>
          {eyebrow ? <p className={cn('mt-1 text-sm font-medium', style.eyebrow)}>{eyebrow}</p> : null}
        </div>
        <div className={cn('space-y-4 px-6 py-5', style.body)}>
          <div className={cn('text-center text-base font-semibold leading-snug', style.message)}>
            {message}
          </div>
          {hint ? <div className={cn('text-center text-sm', style.hint)}>{hint}</div> : null}
          <div className="flex flex-wrap justify-center gap-2">
            {isAlertOnly ? (
              <Button type="button" variant={style.confirmVariant} onClick={onClose}>
                Got it
              </Button>
            ) : (
              <>
                <Button type="button" variant="secondary" onClick={onClose} disabled={isPending}>
                  {cancelLabel}
                </Button>
                <Button
                  type="button"
                  variant={style.confirmVariant}
                  onClick={onConfirm}
                  disabled={isPending}
                >
                  {isPending ? pendingLabel : confirmLabel}
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}
