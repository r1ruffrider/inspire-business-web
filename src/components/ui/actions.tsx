import type { ReactNode } from "react"
import { ArrowDown, ArrowRight } from "lucide-react"
import { Button, type ButtonProps } from "@/components/ui/button"
import { isKeyboardClick, scrollToSection } from "@/lib/lenis"

// Event name phase 2's form can listen for to preselect a service when a
// "Request" link on a service row is used. App holds no state for this.
export const PRESELECT_EVENT = "request-services:preselect"

/** The one primary action: scrolls to the request section. Label is fixed by COPY. */
export function RequestCta({
  variant = "primary",
  size,
  block,
  service,
  label = "Request services",
  ariaLabel,
  onActivate,
  className,
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
}) {
  return (
    <Button asChild variant={variant} size={size} block={block} className={className}>
      <a
        href="#request-services"
        aria-label={ariaLabel}
        onClick={(e) => {
          e.preventDefault()
          onActivate?.()
          if (service) {
            window.dispatchEvent(new CustomEvent(PRESELECT_EVENT, { detail: { service } }))
          }
          scrollToSection("#request-services", { keyboard: isKeyboardClick(e) })
        }}
      >
        {label}
        <ArrowRight className="arr" aria-hidden="true" />
      </a>
    </Button>
  )
}

/** Quiet text link that scrolls to a section, with a down arrow. */
export function SeeLink({ href = "#products", children = "See what we build" }: {
  href?: string
  children?: ReactNode
}) {
  return (
    <a
      className="link"
      href={href}
      onClick={(e) => {
        e.preventDefault()
        scrollToSection(href, { keyboard: isKeyboardClick(e) })
      }}
    >
      {children}
      <ArrowDown aria-hidden="true" />
    </a>
  )
}
