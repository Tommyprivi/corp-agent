interface LogoProps {
  size?: number;
  showWordmark?: boolean;
}

/**
 * Anello sottile aperto in alto a destra (il flusso), con un punto pieno
 * al centro (il nucleo che ragiona).
 */
export function LogoMark({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <circle
        cx="12"
        cy="12"
        r="9.25"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinecap="round"
        strokeDasharray="47.6 10.5"
        transform="rotate(-15 12 12)"
      />
      <circle cx="12" cy="12" r="2.4" fill="currentColor" />
    </svg>
  );
}

export default function Logo({ size = 26, showWordmark = true }: LogoProps) {
  return (
    <span className="flex items-center gap-2 text-[var(--text-primary)]">
      <LogoMark size={size} />
      {showWordmark && (
        <span
          className="font-logo font-extralight leading-none"
          style={{ fontSize: size * 0.76, letterSpacing: "-0.015em" }}
        >
          corp agent
        </span>
      )}
    </span>
  );
}
