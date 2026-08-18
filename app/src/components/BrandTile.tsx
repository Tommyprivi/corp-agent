/**
 * Il riquadro colorato di un servizio da collegare. Non sono i loghi ufficiali dei brand:
 * sono glifi geometrici nei colori del servizio, così l'utente riconosce a colpo d'occhio
 * "questo è WhatsApp" senza che noi ci appropriamo di un marchio registrato.
 */

interface BrandTileProps {
  service: string;
  size?: number;
}

type Brand = { bg: string; glyph: (s: number) => React.ReactNode };

const white = "#fff";

const BRANDS: Record<string, Brand> = {
  whatsapp: {
    bg: "#25D366",
    glyph: (s) => (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
        <path
          d="M4 20l1.3-4A8 8 0 1 1 8 18.7z"
          stroke={white}
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
        <path
          d="M9.3 8.7c-.3.7-.1 1.6.5 2.4.7.9 1.6 1.5 2.5 1.8.8.3 1.5.1 1.9-.4"
          stroke={white}
          strokeWidth="1.6"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
  calendar: {
    bg: "#4285F4",
    glyph: (s) => (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
        <rect x="4.5" y="5.5" width="15" height="14" rx="2.5" stroke={white} strokeWidth="1.8" />
        <path d="M4.5 10h15M9 3.5v3M15 3.5v3" stroke={white} strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    ),
  },
  drive: {
    bg: "#0F9D58",
    glyph: (s) => (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
        <path d="M12 4.5L20 18H4z" stroke={white} strokeWidth="1.8" strokeLinejoin="round" />
        <path d="M8 11.5h8" stroke={white} strokeWidth="1.6" />
      </svg>
    ),
  },
  gmail: {
    bg: "#EA4335",
    glyph: (s) => (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
        <rect x="3.5" y="6" width="17" height="12" rx="2" stroke={white} strokeWidth="1.8" />
        <path d="M4.5 7.5l7.5 5.5 7.5-5.5" stroke={white} strokeWidth="1.8" strokeLinejoin="round" />
      </svg>
    ),
  },
  shopify: {
    bg: "#95BF47",
    glyph: (s) => (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
        <path
          d="M6 8.5h12l-1 11H7z"
          stroke={white}
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
        <path d="M9.5 8.5V7a2.5 2.5 0 0 1 5 0v1.5" stroke={white} strokeWidth="1.8" />
      </svg>
    ),
  },
  instagram: {
    bg: "#E1306C",
    glyph: (s) => (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
        <rect x="4.5" y="4.5" width="15" height="15" rx="4.5" stroke={white} strokeWidth="1.8" />
        <circle cx="12" cy="12" r="3.6" stroke={white} strokeWidth="1.8" />
        <circle cx="16.6" cy="7.4" r="1" fill={white} />
      </svg>
    ),
  },
  telegram: {
    bg: "#229ED9",
    glyph: (s) => (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
        <path
          d="M20 5L3.8 11.4l4.6 1.6L20 5zM8.4 13l1 5 2.4-2.9L20 5"
          stroke={white}
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  stripe: {
    bg: "#635BFF",
    glyph: (s) => (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
        <path
          d="M15.5 8.2c-1-.5-2-.7-3-.7-1.7 0-2.8.7-2.8 1.9 0 1.3 1.5 1.8 3.1 2.4 1.9.7 3.2 1.5 3.2 3.3 0 2-1.7 3.1-4 3.1-1.3 0-2.6-.3-3.6-.8"
          stroke={white}
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
  notion: {
    bg: "#111",
    glyph: (s) => (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
        <rect x="4.5" y="4.5" width="15" height="15" rx="2" stroke={white} strokeWidth="1.8" />
        <path d="M9 16V9l6 7V9" stroke={white} strokeWidth="1.8" strokeLinejoin="round" />
      </svg>
    ),
  },
  generic: {
    bg: "#86868B",
    glyph: (s) => (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
        <path
          d="M9.5 14.5l5-5M8 12l-2 2a2.8 2.8 0 0 0 4 4l2-2M16 12l2-2a2.8 2.8 0 0 0-4-4l-2 2"
          stroke={white}
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
};

/** Riconosce il servizio dal nome scritto in italiano nei kit. */
export function brandKeyFor(service: string): string {
  const s = service.toLowerCase();
  if (s.includes("whatsapp")) return "whatsapp";
  if (s.includes("calendar")) return "calendar";
  if (s.includes("drive") || s.includes("sheets")) return "drive";
  if (s.includes("gmail") || s.includes("mail")) return "gmail";
  if (s.includes("shopify") || s.includes("woocommerce")) return "shopify";
  if (s.includes("instagram")) return "instagram";
  if (s.includes("telegram")) return "telegram";
  if (s.includes("stripe") || s.includes("paypal")) return "stripe";
  if (s.includes("notion")) return "notion";
  return "generic";
}

export default function BrandTile({ service, size = 40 }: BrandTileProps) {
  const brand = BRANDS[brandKeyFor(service)];
  return (
    <span
      aria-hidden="true"
      className="flex shrink-0 items-center justify-center rounded-xl"
      style={{ background: brand.bg, width: size, height: size }}
    >
      {brand.glyph(Math.round(size * 0.58))}
    </span>
  );
}
