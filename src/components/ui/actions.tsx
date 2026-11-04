import type { ReactNode } from "react"
import { ArrowDown, ArrowRight } from "lucide-react"
import { Button, type ButtonProps } from "@/components/ui/button"
import { scrollToSection } from "@/lib/scroll"

// Event the form listens for to preselect a service when a service's
// "Request" link is used. App holds no state for this.
export const PRESELECT_EVENT = "request-services:preselect"

/** The one primary action: jumps to the request form. Same words everywhere. */
export function RequestCta({
  variant = "primary",
  size,
  block,
  service,
  label = "Request services",
  ariaLabel,
  onActivate,
  className,
  id,
  tabIndex,
}: {
  variant?: ButtonProps["variant"]
  size?: ButtonProps["size"]
  block?: ButtonProps["block"]
  /** Service id to preselect (optional). */
  service?: string
  label?: ReactNode
  ariaLabel?: string
  /** Called on activation (e.g. to close the mobile menu first). */
  onActivate?: () => void
  className?: string
  id?: string
  tabIndex?: number
}) {
  return (
    <Button asChild variant={variant} size={size} block={block} className={className}>
      <a
        id={id}
        tabIndex={tabIndex}
        href="#request-services"
        aria-label={ariaLabel}
        onClick={(e) => {
          e.preventDefault()
          onActivate?.()
          if (service) {
            window.dispatchEvent(new CustomEvent(PRESELECT_EVENT, { detail: { service } }))
          }
          scrollToSection("#request-services")
        }}
      >
        {label}
        <ArrowRight className="arr" aria-hidden="true" />
      </a>
    </Button>
  )
}

/** Quiet text link that jumps to a section, with a down arrow. */
export function SeeLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a
      className="link"
      href={href}
      onClick={(e) => {
        e.preventDefault()
        scrollToSection(href)
      }}
    >
      {children}
      <ArrowDown aria-hidden="true" />
    </a>
  )
}
