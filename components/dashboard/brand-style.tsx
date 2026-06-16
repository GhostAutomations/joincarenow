/**
 * Injects a company's brand colours as CSS variables for the whole document.
 * Renders nothing when the company hasn't set a custom brand, so default
 * companies keep the standard Join Care Now teal palette.
 *
 * Setting --brand-primary also rebuilds the entire `brand-*` Tailwind palette
 * (buttons, links, active states) from that single colour using color-mix,
 * so the app themes coherently from one hex value.
 */
export type Brand = {
  primary?: string | null;
  secondary?: string | null;
  accent?: string | null;
};

const HEX = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
const safe = (v: string | null | undefined, fallback: string) =>
  v && HEX.test(v) ? v : fallback;

export function BrandStyle({ brand }: { brand?: Brand | null }) {
  if (!brand || (!brand.primary && !brand.secondary && !brand.accent)) return null;

  const primary = safe(brand.primary, "#0d9488");
  const secondary = safe(brand.secondary, "#0e7490");
  const accent = safe(brand.accent, "#3730a3");

  const css = `:root{
    --brand-primary:${primary};
    --brand-secondary:${secondary};
    --brand-accent:${accent};
    --color-brand-50:color-mix(in srgb, ${primary} 8%, white);
    --color-brand-100:color-mix(in srgb, ${primary} 14%, white);
    --color-brand-200:color-mix(in srgb, ${primary} 24%, white);
    --color-brand-300:color-mix(in srgb, ${primary} 40%, white);
    --color-brand-400:color-mix(in srgb, ${primary} 66%, white);
    --color-brand-500:${primary};
    --color-brand-600:color-mix(in srgb, ${primary}, black 8%);
    --color-brand-700:color-mix(in srgb, ${primary}, black 22%);
    --color-brand-800:color-mix(in srgb, ${primary}, black 35%);
    --color-brand-900:color-mix(in srgb, ${primary}, black 45%);
    --color-brand-950:color-mix(in srgb, ${primary}, black 55%);
  }`;

  return <style dangerouslySetInnerHTML={{ __html: css }} />;
}
