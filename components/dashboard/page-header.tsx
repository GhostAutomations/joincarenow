/** Vivid gradient banner across the top of a page — matches the dashboard look.
 *  Breaks out of the main padding to run edge-to-edge. Pass right-side controls
 *  as children. */
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
    <div className="relative -mx-4 -mt-4 mb-6 overflow-hidden bg-gradient-to-br from-teal-600 via-cyan-700 to-indigo-800 px-4 py-6 text-white sm:-mx-6 sm:-mt-6 sm:px-6">
      <div className="jcn-blob pointer-events-none absolute -right-10 -top-16 h-48 w-48 rounded-full bg-fuchsia-400/25 blur-3xl" />
      <div className="relative flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{title}</h1>
          {subtitle && <p className="mt-1 max-w-2xl text-sm text-white/75">{subtitle}</p>}
        </div>
        {children && <div className="flex items-center gap-2">{children}</div>}
      </div>
    </div>
  );
}
