type Props = {
  title: string;
  description?: string;
  actions?: React.ReactNode;
};

export function PageHeader({ title, description, actions }: Props) {
  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between mb-6 pb-4 border-b border-border">
      <div>
        <h1 className="text-[26px] font-semibold tracking-tight leading-tight">
          {title}
        </h1>
        {description && (
          <p className="text-sm text-muted-foreground mt-1.5">{description}</p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
