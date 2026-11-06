// 16px-grid stroke icons in the Linear manner: thin, rounded, quiet.
const PATHS = {
  search: <><circle cx="7.2" cy="7.2" r="4.7" /><path d="m13.5 13.5-2.9-2.9" /></>,
  star: <path d="m8 2.3 1.75 3.55 3.9.57-2.83 2.75.67 3.88L8 11.22l-3.49 1.83.67-3.88L2.35 6.42l3.9-.57z" />,
  copy: <><rect x="5.5" y="5.5" width="8" height="8" rx="1.6" /><path d="M10.5 3.6V3.2c0-.66-.54-1.2-1.2-1.2H3.7c-.66 0-1.2.54-1.2 1.2v5.6c0 .66.54 1.2 1.2 1.2h.4" /></>,
  check: <path d="m3.5 8.4 2.9 2.9 6-6.3" />,
  external: <><path d="M9.5 2.5h4v4" /><path d="M13.5 2.5 7.8 8.2" /><path d="M12 9.5v3a1 1 0 0 1-1 1H3.5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h3" /></>,
  x: <path d="m4 4 8 8M12 4l-8 8" />,
  chevron: <path d="m5.5 6.5 2.5 2.5 2.5-2.5" />,
  chevronRight: <path d="m6.5 4.5 3 3.5-3 3.5" />,
  sun: <><circle cx="8" cy="8" r="2.8" /><path d="M8 1.8v1.2M8 13v1.2M3.6 3.6l.85.85M11.55 11.55l.85.85M1.8 8H3M13 8h1.2M3.6 12.4l.85-.85M11.55 4.45l.85-.85" /></>,
  moon: <path d="M13.3 9.6A5.6 5.6 0 0 1 6.4 2.7a5.6 5.6 0 1 0 6.9 6.9z" />,
  monitor: <><rect x="2" y="3" width="12" height="8" rx="1.4" /><path d="M5.5 13.5h5M8 11v2.5" /></>,
  menu: <path d="M2.5 4.5h11M2.5 8h11M2.5 11.5h11" />,
  user: <><circle cx="8" cy="5.6" r="2.4" /><path d="M3.3 13.3c.5-2.3 2.4-3.6 4.7-3.6s4.2 1.3 4.7 3.6" /></>,
  pin: <><path d="M8 14s-4.3-3.7-4.3-7.3a4.3 4.3 0 0 1 8.6 0C12.3 10.3 8 14 8 14z" /><circle cx="8" cy="6.6" r="1.5" /></>,
  filter: <path d="M2.5 4h11M4.5 8h7M6.5 12h3" />,
  book: <><path d="M3 3.2c0-.66.54-1.2 1.2-1.2h8.3v10.5H4.2c-.66 0-1.2.54-1.2 1.2z" /><path d="M3 13.7c0 .66.54 1.2 1.2 1.2h8.3v-2.4" /></>,
  layers: <><path d="m8 2 6 3.2-6 3.2-6-3.2z" /><path d="m2 8.2 6 3.2 6-3.2" /><path d="m2 11 6 3.2 6-3.2" /></>,
  calendar: <><rect x="2.3" y="3" width="11.4" height="10.7" rx="1.6" /><path d="M2.3 6.5h11.4M5.5 1.8v2.4M10.5 1.8v2.4" /></>,
  clock: <><circle cx="8" cy="8" r="5.8" /><path d="M8 4.8V8l2.2 1.4" /></>,
  inbox: <><path d="M2 9.2 3.8 3.5h8.4L14 9.2v3.3c0 .55-.45 1-1 1H3c-.55 0-1-.45-1-1z" /><path d="M2 9.2h3.3l.8 1.6h3.8l.8-1.6H14" /></>,
  bolt: <path d="M9 1.8 3.6 9h4l-.6 5.2L12.4 7h-4z" />,
  arrowRight: <path d="M3 8h10M9.5 4.5 13 8l-3.5 3.5" />,
}

export default function Icon({ name, size = 16, filled = false, className }) {
  return (
    <svg
      className={className ? `icon ${className}` : 'icon'}
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth="1.35"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {PATHS[name]}
    </svg>
  )
}

/** Linear-style progress pie: a ring with a filled wedge for how full the section is. */
export function SeatPie({ taken, capacity, tone, size = 14 }) {
  const frac = capacity ? Math.min(1, Math.max(0, taken / capacity)) : 1
  const c = 2 * Math.PI * 2.6
  return (
    <svg className={`pie ${tone}`} width={size} height={size} viewBox="0 0 14 14" aria-hidden="true">
      <circle cx="7" cy="7" r="6" fill="none" stroke="currentColor" strokeWidth="1.4" />
      {frac > 0 && (
        <circle
          cx="7" cy="7" r="2.6" fill="none" stroke="currentColor" strokeWidth="5.2"
          strokeDasharray={`${frac * c} ${c}`} transform="rotate(-90 7 7)"
        />
      )}
    </svg>
  )
}
