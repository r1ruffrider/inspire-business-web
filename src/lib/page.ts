export type PageId = "home" | "team"

/** Which document this view is. Passed in during prerender; read from the URL in the browser. */
export function detectPage(): PageId {
  if (typeof window === "undefined") return "home"
  const path = window.location.pathname.replace(/\/+$/, "") || "/"
  return path === "/team" ? "team" : "home"
}

/** True when the href stays on the document the visitor is already reading. */
export function isSamePage(href: string, page: PageId): boolean {
  if (page === "team") return href === "/team" || href.startsWith("/team#")
  return href === "/" || href.startsWith("/#") || href.startsWith("#")
}

/** In-page target for a same-document link. Cross-page links are not scrolled. */
export function scrollSelector(href: string): string {
  const hashAt = href.indexOf("#")
  if (hashAt >= 0) return href.slice(hashAt)
  return href === "/team" ? "#team" : "#top"
}
