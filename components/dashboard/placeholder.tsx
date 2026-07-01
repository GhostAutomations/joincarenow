export function PlaceholderPage({
  title,
  phase,
  description,
}: {
  title: string;
  phase: string;
  description: string;
}) {
  return (
    <div>
      <h1 className="text-2xl font-semibold text-gray-900">{title}</h1>
      <div className="mt-6 rounded-xl border border-dashed border-white/40 bg-white p-10 text-center">
        <span className="inline-block rounded-full bg-brand-50 px-3 py-1 text-xs font-medium text-brand-700">
          Coming in {phase}
        </span>
        <p className="mx-auto mt-3 max-w-md text-sm text-gray-600">
          {description}
        </p>
      </div>
    </div>
  );
}
