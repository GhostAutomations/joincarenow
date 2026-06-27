/** Styled form header (logo + title + description) as configured in the form
 *  builder, shown to applicants on the public apply page. Falls back to the
 *  company logo when the form has none of its own. */
export type FormHeaderStyle = {
  title?: { color?: string; size?: string; align?: string };
  description?: { color?: string; size?: string; align?: string };
  logo_url?: string;
  logo_align?: string;
};

const SIZE_CLASS: Record<string, string> = {
  sm: "text-sm", base: "text-base", lg: "text-lg", xl: "text-xl", "2xl": "text-2xl", "3xl": "text-3xl",
};
const alignCls = (a?: string) =>
  a === "center" ? "text-center" : a === "right" ? "text-right" : "text-left";
const justifyCls = (a?: string) =>
  a === "center" ? "justify-center" : a === "right" ? "justify-end" : "justify-start";

export function FormHeader({
  name,
  description,
  style,
  fallbackLogo = null,
}: {
  name: string;
  description?: string | null;
  style?: FormHeaderStyle | null;
  fallbackLogo?: string | null;
}) {
  const ts = style?.title;
  const ds = style?.description;
  const logo = style?.logo_url || fallbackLogo;

  return (
    <div className="mb-6">
      {logo && (
        <div className={`mb-3 flex ${justifyCls(style?.logo_align)}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={logo} alt="" className="h-12 w-auto" />
        </div>
      )}
      <h1
        className={`font-bold ${SIZE_CLASS[ts?.size ?? "2xl"]} ${alignCls(ts?.align)}`}
        style={{ color: ts?.color ?? "#111827" }}
      >
        {name}
      </h1>
      {description && (
        <p
          className={`mt-1 whitespace-pre-wrap ${SIZE_CLASS[ds?.size ?? "sm"]} ${alignCls(ds?.align)}`}
          style={{ color: ds?.color ?? "#374151" }}
        >
          {description}
        </p>
      )}
    </div>
  );
}
