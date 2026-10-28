import type { ReactNode } from "react"

/**
 * Marlon's rule: never invent a claim, leave a marked TODO. A TODO is a visible
 * dashed chip only when VITE_SHOW_TODOS=1 (dev or a preview build); in a
 * production build it renders nothing.
 *
 * At each call site, guard with SHOW_TODOS so the strings are also dropped
 * from the production bundle:
 *   {SHOW_TODOS && <Todo what="Marlon: product URL" />}
 * scripts/list-todos.mjs lists every <Todo what="..."> in src/.
 */
export const SHOW_TODOS: boolean = import.meta.env.VITE_SHOW_TODOS === "1"

export default function Todo({ what, children }: { what: string; children?: ReactNode }) {
  if (!SHOW_TODOS) return null
  return (
    <span className="todo" role="note">
      <b>TODO</b> {what}
      {children}
    </span>
  )
}
