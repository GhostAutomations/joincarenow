/** Page title block — sits directly on the app's gradient background.
 *  White text; pass right-side controls as children. */
export function PageHeader({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold text-white drop-shadow-sm">{title}</h1>
        {subtitle && <p className="mt-1 max-w-2xl text-sm text-white/80">{subtitle}</p>}
      </div>
      {children && <div className="flex items-center gap-2">{children}</div>}
    </div>
  );
}
