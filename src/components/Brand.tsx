import type { MouseEvent } from "react"

/**
 * Interim brand mark: an "IB" monogram in the accent colour plus a plain-text
 * wordmark (no gradient). Temporary until Marlon supplies a logo file
 * (OWNER-TODO.md). The same drawing is public/favicon.svg.
 */
export function Monogram({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 32 32" width="28" height="28" aria-hidden="true" focusable="false">
      <rect width="32" height="32" rx="7" fill="var(--accent)" />
      <rect x="8" y="8.5" width="3.2" height="15" rx="0.6" fill="#fff" />
      <path
        d="M15.6 10.1h4.6a3.15 3.15 0 0 1 0 6.3h-4.6M15.6 16.4h5.2a3.5 3.5 0 0 1 0 7h-5.2V10.1"
        fill="none"
        stroke="#fff"
        strokeWidth="3.2"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function Wordmark({ onClick, href = "#top" }: { onClick?: (e: MouseEvent<HTMLAnchorElement>) => void; href?: string }) {
  return (
    <a href={href} className="wordmark" translate="no" aria-label="Inspire Business Group, back to top" onClick={onClick}>
      <Monogram className="wordmark__mark" />
      <span className="wordmark__text">
        <span>Inspire</span> <span>Business Group</span>
      </span>
    </a>
  )
}
