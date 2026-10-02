/** The Salt & Story mark: a marigold speech bubble with three grains of salt. */
export function LogoMark({ size = 36, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" className={className}>
      <rect width="64" height="64" rx="16" fill="var(--primary)" />
      <path
        d="M14 15h36a7 7 0 0 1 7 7v17a7 7 0 0 1-7 7H31l-10 8v-8h-7a7 7 0 0 1-7-7V22a7 7 0 0 1 7-7z"
        fill="var(--accent)"
      />
      {[22, 32, 42].map((cx) => <circle key={cx} cx={cx} cy="30.5" r="3.6" fill="#1D3529" />)}
    </svg>
  );
}

/*
  Spot illustrations drawn for this project. One grammar throughout:
  96x96 grid, 2.6 round strokes in currentColor, butter and marigold fills.
  Paths carry class "ill" so GSAP can draw them in.
*/
type IllProps = { className?: string; title?: string };

function Frame({ children, className = "", title }: IllProps & { children: React.ReactNode }) {
  return (
    <svg viewBox="0 0 96 96" className={className} role={title ? "img" : undefined}
      aria-label={title} aria-hidden={title ? undefined : true}>
      {children}
    </svg>
  );
}

/** A kitchen microphone catching a voice. */
export function MicIllustration(p: IllProps) {
  return (
    <Frame {...p}>
      <circle cx="48" cy="48" r="40" fill="var(--accent-soft)" />
      <rect x="37" y="20" width="22" height="36" rx="11" fill="var(--surface)" className="ill" />
      <path className="ill" d="M42 31h12M42 38h12M42 45h12" />
      <path className="ill" d="M29 46a19 19 0 0 0 38 0M48 65v9M38 75h20" />
      <path className="ill" d="M70 26c3 3 4.5 7 4.5 11s-1.5 8-4.5 11M76 20c4.5 4.5 7 10.5 7 17s-2.5 12.5-7 17" stroke="var(--accent)" />
    </Frame>
  );
}

/** An index card with ruled lines and a pencil. */
export function CardIllustration(p: IllProps) {
  return (
    <Frame {...p}>
      <circle cx="48" cy="48" r="40" fill="var(--accent-soft)" />
      <g transform="rotate(-6 48 48)">
        <rect x="18" y="26" width="54" height="40" rx="5" fill="var(--surface)" className="ill" />
        <path className="ill" d="M18 36h54" stroke="var(--accent)" />
        <path className="ill" d="M25 45h30M25 52h38M25 59h22" />
      </g>
      <path className="ill" d="M60 74l18-18 6 6-18 18-8 2z" fill="var(--accent)" />
      <path className="ill" d="M74 60l6 6" />
    </Frame>
  );
}

/** An open cookbook with a ribbon. */
export function BookIllustration(p: IllProps) {
  return (
    <Frame {...p}>
      <circle cx="48" cy="48" r="40" fill="var(--accent-soft)" />
      <path className="ill" fill="var(--surface)" d="M48 30c-8-5-18-6-28-4v42c10-2 20-1 28 4 8-5 18-6 28-4V26c-10-2-20-1-28 4z" />
      <path className="ill" d="M48 30v42" />
      <path className="ill" d="M26 38c6-1 11-.5 16 1.5M26 46c6-1 11-.5 16 1.5M54 39.5c5-2 10-2.5 16-1.5M54 47.5c5-2 10-2.5 16-1.5" />
      <path className="ill" d="M62 27v20l4-3 4 3V26" fill="var(--accent)" stroke="var(--accent)" />
    </Frame>
  );
}

/** A pot with its lid lifted and nothing inside. Used on the 404 page. */
export function EmptyPotIllustration(p: IllProps) {
  return (
    <Frame {...p}>
      <circle cx="48" cy="48" r="40" fill="var(--accent-soft)" />
      <path className="ill" fill="var(--surface)" d="M22 46h52v16a12 12 0 0 1-12 12H34a12 12 0 0 1-12-12z" />
      <path className="ill" d="M16 50h6M74 50h6" />
      <g transform="rotate(-14 30 36)">
        <path className="ill" fill="var(--surface)" d="M24 38c0-6 11-10 24-10s24 4 24 10z" />
        <path className="ill" d="M44 24h8" />
      </g>
      <path className="ill" d="M46 56c2-2 4-2 6 0" stroke="var(--accent)" />
    </Frame>
  );
}

/** A pot boiling over. Used on the error page. */
export function BoiledOverIllustration(p: IllProps) {
  return (
    <Frame {...p}>
      <circle cx="48" cy="48" r="40" fill="var(--accent-soft)" />
      <path className="ill" fill="var(--surface)" d="M22 44h52v18a12 12 0 0 1-12 12H34a12 12 0 0 1-12-12z" />
      <path className="ill" d="M16 48h6M74 48h6" />
      <path className="ill" fill="var(--accent)" stroke="var(--accent)"
        d="M22 44c0-5 4-9 9-8 2-5 9-7 13-3 4-4 11-3 13 2 5-2 11 1 11 6 3 0 6 1 6 3v3c0 2-2 3-3 2v6c0 2-3 2-3 0v-5c-2 0-3-1-3-2H22z" />
      <path className="ill" d="M38 22c-2-3 2-5 0-8M52 22c-2-3 2-5 0-8" />
    </Frame>
  );
}

/** A sleeping kettle. Used while the server wakes up. */
export function KettleIllustration(p: IllProps) {
  return (
    <Frame {...p}>
      <circle cx="48" cy="48" r="40" fill="var(--accent-soft)" />
      <path className="ill" fill="var(--surface)" d="M28 70l4-26a16 16 0 0 1 32 0l4 26z" />
      <path className="ill" d="M30 54c-8-1-12-8-12-14" />
      <path className="ill" d="M38 34c0-8 20-8 20 0" />
      <path className="ill" d="M24 70h48" />
      <path className="ill" d="M64 18h8l-8 8h8M76 8h6l-6 6h6" stroke="var(--accent)" />
    </Frame>
  );
}
