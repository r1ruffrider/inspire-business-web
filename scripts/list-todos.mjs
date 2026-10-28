// Lists every <Todo what="..."> in src/ with file, line and text, so the final
// brief can hand Marlon one list. Usage: node scripts/list-todos.mjs
import { readdirSync, readFileSync, statSync } from "node:fs"
import { join, relative, sep } from "node:path"
import { fileURLToPath } from "node:url"

const root = join(fileURLToPath(new URL(".", import.meta.url)), "..")
const src = join(root, "src")

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) yield* walk(p)
    else if (/\.(tsx?|jsx?)$/.test(name)) yield p
  }
}

// <Todo what="..."> or <Todo what={`...`}> (template literal), possibly over lines.
const re = /<Todo\b[^>]*?\bwhat=(?:"([^"]*)"|\{`([^`]*)`\})/g
const rows = []
for (const file of walk(src)) {
  if (file.endsWith(`${sep}Todo.tsx`)) continue
  const text = readFileSync(file, "utf8")
  for (const m of text.matchAll(re)) {
    const line = text.slice(0, m.index).split("\n").length
    rows.push({ file: relative(root, file).split(sep).join("/"), line, what: m[1] ?? m[2] })
  }
}

rows.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line)
for (const r of rows) console.log(`${r.file}:${r.line}  ${r.what}`)
console.log(`\n${rows.length} TODO(s). Visible only with VITE_SHOW_TODOS=1; none render in production.`)
