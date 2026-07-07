interface PageHeaderProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export function PageHeader({ title, description, action }: PageHeaderProps) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div>
        <h2 className="text-2xl font-bold text-text">{title}</h2>
        {description && <p className="mt-1 text-sm text-text-light">{description}</p>}
      </div>
      {action}
    </div>
  );
}
