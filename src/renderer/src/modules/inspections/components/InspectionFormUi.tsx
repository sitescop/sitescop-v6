import { createContext, useContext, type ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/cn';

export const InspectionFormContext = createContext(false);

export const INSPECTION_INPUT_CLASS =
  'w-full rounded-lg border border-border bg-white px-3 py-2.5 text-sm text-text shadow-[0_1px_2px_rgba(15,23,42,0.06)] transition-all duration-150 hover:border-primary/35 focus:border-primary focus:ring-2 focus:ring-primary/15';

export const INSPECTION_COMMENTS_TEXTAREA_CLASS =
  'inspection-comments-textarea w-full min-h-[5.5rem] resize-y rounded-lg border border-secondary/30 bg-white px-4 py-3 text-sm leading-relaxed text-text shadow-[0_1px_3px_rgba(0,90,156,0.1)] placeholder:text-text-muted transition-all duration-150 hover:border-secondary/45 focus:border-secondary focus:ring-2 focus:ring-secondary/20';

export const INSPECTION_LABEL_CLASS = 'mb-1 flex items-center gap-1.5 text-sm font-bold text-primary';

export function useInspectionFormStyles() {
  return useContext(InspectionFormContext);
}

export function InspectionFormProvider({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <InspectionFormContext.Provider value={true}>
      <div className={cn('inspection-form', className)}>{children}</div>
    </InspectionFormContext.Provider>
  );
}

export function InspectionSection({
  title,
  children,
  className,
}: {
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn('inspection-section', className)}>
      <h3 className="inspection-section-heading">{title}</h3>
      {children}
    </section>
  );
}

export function InspectionFieldLabel({
  icon: Icon,
  htmlFor,
  children,
}: {
  icon?: LucideIcon;
  htmlFor?: string;
  children: ReactNode;
}) {
  return (
    <label htmlFor={htmlFor} className={INSPECTION_LABEL_CLASS}>
      {Icon ? (
        <Icon className="h-3.5 w-3.5 shrink-0 text-accent" strokeWidth={2.25} aria-hidden />
      ) : (
        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent" aria-hidden />
      )}
      <span>{children}</span>
    </label>
  );
}

export function InspectionField({
  id,
  label,
  icon,
  children,
  className,
}: {
  id: string;
  label: string;
  icon?: LucideIcon;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <InspectionFieldLabel icon={icon} htmlFor={id}>
        {label}
      </InspectionFieldLabel>
      {children}
    </div>
  );
}

export function InspectionSubPanel({
  title,
  children,
  className,
}: {
  title?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('inspection-subpanel', className)}>
      {title ? <p className="inspection-subsection-heading">{title}</p> : null}
      {children}
    </div>
  );
}
