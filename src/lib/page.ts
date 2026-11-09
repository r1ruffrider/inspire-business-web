export type PageId = "home" | "team" | "work"

/** Which document this view is. Passed in during prerender; read from the URL in the browser. */
export function detectPage(): PageId {
  if (typeof window === "undefined") return "home"
  const path = window.location.pathname.replace(/\/+$/, "") || "/"
  if (path === "/team") return "team"
  if (path === "/work") return "work"
  return "home"
}

/** True when the href stays on the document the visitor is already reading. */
export function isSamePage(href: string, page: PageId): boolean {
  if (page === "team") return href === "/team" || href.startsWith("/team#")
  if (page === "work") return href === "/work" || href.startsWith("/work#")
  return href === "/" || href.startsWith("/#") || href.startsWith("#")
}

/** In-page target for a same-document link. Cross-page links are not scrolled. */
export function scrollSelector(href: string): string {
  const hashAt = href.indexOf("#")
  if (hashAt >= 0) return href.slice(hashAt)
  if (href === "/team") return "#team"
  if (href === "/work") return "#work"
  return "#top"
}

/** Marks the nav item for the document the visitor is on. */
export function pageCurrent(href: string, page: PageId): "page" | undefined {
  if (page === "team" && href === "/team") return "page"
  if (page === "work" && href === "/work") return "page"
  return undefined
}
