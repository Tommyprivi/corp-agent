const base = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

/** Fumetto con scintilla: il centro di controllo conversazionale. */
export function ChatSparkIcon({ size = 19 }: { size?: number }) {
  return (
    <svg width={size} height={size} {...base}>
      <path d="M20 9.4v4.1A2.5 2.5 0 0 1 17.5 16H11l-3.4 2.9a.6.6 0 0 1-1-.46V16h-.1A2.5 2.5 0 0 1 4 13.5v-7A2.5 2.5 0 0 1 6.5 4h7.7" />
      <path
        d="M18.5 2.9l.66 1.79 1.79.66-1.79.66-.66 1.79-.66-1.79-1.79-.66 1.79-.66z"
        fill="currentColor"
        stroke="none"
      />
    </svg>
  );
}

/** Processore con barre di dati: gli agenti configurati. */
export function AgentsIcon({ size = 19 }: { size?: number }) {
  return (
    <svg width={size} height={size} {...base}>
      <rect x="6.25" y="6.25" width="11.5" height="11.5" rx="2.5" />
      <path d="M9.75 14.4v-2.6M12 14.4v-4.6M14.25 14.4v-1.6" />
      <path d="M9.5 3.6v2.65M14.5 3.6v2.65M9.5 17.75v2.65M14.5 17.75v2.65M3.6 9.5h2.65M3.6 14.5h2.65M17.75 9.5h2.65M17.75 14.5h2.65" />
    </svg>
  );
}

/** Nodi collegati: i flussi di automazione. */
export function FlowsIcon({ size = 19 }: { size?: number }) {
  return (
    <svg width={size} height={size} {...base}>
      <circle cx="5.6" cy="6.4" r="2.3" />
      <circle cx="5.6" cy="17.6" r="2.3" />
      <circle cx="18.4" cy="12" r="2.3" />
      <path d="M7.75 7.35l8.6 3.7M7.75 16.65l8.6-3.7" />
    </svg>
  );
}

/** Ingranaggio: le impostazioni dell'account. */
export function GearIcon({ size = 19 }: { size?: number }) {
  return (
    <svg width={size} height={size} {...base}>
      <circle cx="12" cy="12" r="3.1" />
      <path d="M19.05 14.28a1.3 1.3 0 0 0 .26 1.43l.05.05a1.58 1.58 0 1 1-2.24 2.24l-.05-.05a1.3 1.3 0 0 0-1.43-.26 1.3 1.3 0 0 0-.79 1.19v.14a1.58 1.58 0 1 1-3.16 0v-.07a1.3 1.3 0 0 0-.85-1.19 1.3 1.3 0 0 0-1.43.26l-.05.05a1.58 1.58 0 1 1-2.24-2.24l.05-.05a1.3 1.3 0 0 0 .26-1.43 1.3 1.3 0 0 0-1.19-.79H5.9a1.58 1.58 0 1 1 0-3.16h.07a1.3 1.3 0 0 0 1.19-.85 1.3 1.3 0 0 0-.26-1.43l-.05-.05a1.58 1.58 0 1 1 2.24-2.24l.05.05a1.3 1.3 0 0 0 1.43.26h.06a1.3 1.3 0 0 0 .79-1.19V5.9a1.58 1.58 0 1 1 3.16 0v.07a1.3 1.3 0 0 0 .79 1.19 1.3 1.3 0 0 0 1.43-.26l.05-.05a1.58 1.58 0 1 1 2.24 2.24l-.05.05a1.3 1.3 0 0 0-.26 1.43v.06a1.3 1.3 0 0 0 1.19.79h.14a1.58 1.58 0 1 1 0 3.16h-.07a1.3 1.3 0 0 0-1.19.79z" />
    </svg>
  );
}

/** Due fogli sovrapposti: duplica. */
export function DuplicateIcon({ size = 15 }: { size?: number }) {
  return (
    <svg width={size} height={size} {...base}>
      <rect x="9" y="9" width="11" height="11" rx="2.4" />
      <path d="M15 6.5V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h.5" />
    </svg>
  );
}

export function ArrowUpIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} {...base} strokeWidth={2}>
      <path d="M12 19V5M6 11l6-6 6 6" />
    </svg>
  );
}

export function CloseIcon({ size = 15 }: { size?: number }) {
  return (
    <svg width={size} height={size} {...base}>
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

export function CheckIcon({ size = 15 }: { size?: number }) {
  return (
    <svg width={size} height={size} {...base} strokeWidth={2}>
      <path d="M4.5 12.5l5 5 10-11" />
    </svg>
  );
}

export function ChevronRightIcon({ size = 15 }: { size?: number }) {
  return (
    <svg width={size} height={size} {...base}>
      <path d="M9 5l7 7-7 7" />
    </svg>
  );
}

/** Sondaggio: social media. */
export function SocialIcon({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} {...base}>
      <rect x="3.5" y="3.5" width="17" height="17" rx="4.5" />
      <circle cx="12" cy="12" r="3.8" />
      <circle cx="16.9" cy="7.1" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

/** Sondaggio: motori di ricerca e pubblicità. */
export function SearchIcon({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} {...base}>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="M15.4 15.4L21 21" />
    </svg>
  );
}

/** Sondaggio: passaparola. Due persone stilizzate. */
export function PeopleIcon({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} {...base}>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3.5 20v-1.4A4.1 4.1 0 0 1 7.6 14.5h2.8a4.1 4.1 0 0 1 4.1 4.1V20" />
      <path d="M16.2 5.4a3.2 3.2 0 0 1 0 5.2M17.5 14.6h.4a4.1 4.1 0 0 1 4.1 4.1V20" />
    </svg>
  );
}

/** Sondaggio: canali IA. */
export function AiIcon({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} {...base}>
      <circle cx="12" cy="12" r="2.6" />
      <path d="M12 3.2v6.2M12 14.4v6.4M4.4 7.8l5.3 3M14.3 13.2l5.3 3M19.6 7.8l-5.3 3M9.7 13.2l-5.3 3" />
    </svg>
  );
}

/** Sondaggio: lavoro da solo. */
export function SinglePersonIcon({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} {...base}>
      <circle cx="12" cy="8" r="3.6" />
      <path d="M5.5 20.5v-1.6a4.4 4.4 0 0 1 4.4-4.4h4.2a4.4 4.4 0 0 1 4.4 4.4v1.6" />
    </svg>
  );
}

/** Sondaggio: lavoro in team. */
export function TeamIcon({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} {...base}>
      <circle cx="8" cy="8.5" r="2.8" />
      <circle cx="16" cy="8.5" r="2.8" />
      <path d="M2.8 19.5v-1.2A3.6 3.6 0 0 1 6.4 14.7h3.2a3.6 3.6 0 0 1 3.6 3.6v1.2" />
      <path d="M14.6 14.7h3a3.6 3.6 0 0 1 3.6 3.6v1.2" />
    </svg>
  );
}

/** Verifica anti-bot: scudo. */
export function ShieldIcon({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} {...base}>
      <path d="M12 3.2l7 2.6v5.5c0 4.3-2.9 8.2-7 9.5-4.1-1.3-7-5.2-7-9.5V5.8z" />
      <path d="M9 12.2l2.2 2.2 4-4.3" />
    </svg>
  );
}

export function GoogleGlyph({ size = 17 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.91c1.7-1.57 2.69-3.88 2.69-6.62z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.91-2.26c-.81.54-1.84.86-3.05.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.34A9 9 0 0 0 9 18z"
      />
      <path fill="#FBBC05" d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.94H.96a9 9 0 0 0 0 8.12l3.01-2.34z" />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.94l3.01 2.34C4.68 5.16 6.66 3.58 9 3.58z"
      />
    </svg>
  );
}

export function AppleGlyph({ size = 17 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" fill="currentColor" aria-hidden="true">
      <path d="M12.28 9.56c.01 1.98 1.73 2.64 1.75 2.65-.01.05-.28.95-.91 1.88-.55.8-1.12 1.6-2.02 1.62-.88.01-1.17-.52-2.18-.52-1.01 0-1.33.51-2.17.53-.87.03-1.53-.86-2.08-1.66-1.2-1.74-2.12-4.91-.89-7.06.61-1.06 1.71-1.74 2.9-1.75.86-.02 1.67.58 2.19.58.52 0 1.5-.71 2.53-.61.43.02 1.64.16 2.42 1.18-.06.04-1.44.84-1.43 2.51zM10.9 3.3c.46-.56.77-1.34.69-2.11-.68.03-1.5.45-1.98 1.01-.43.5-.8 1.29-.7 2.06.76.06 1.53-.39 1.99-.96z" />
    </svg>
  );
}
