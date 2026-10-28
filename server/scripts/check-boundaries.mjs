// Boundary check (THREAT-MODEL T15, ARCHITECTURE 2.6). No dependencies.
//   1. src/ must never import server/ or api/ (static, dynamic, re-export, or require).
//   2. shared/ (non-test files) must never read env, touch Node built-ins, or import outside shared/.
//   3. src/ and shared/ must not mention process.env or secret-looking strings.
// Run: npm run check:boundaries   (exit code 1 on any violation)
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

// BOUNDARY_ROOT lets the test suite point the script at a throwaway tree.
const root = process.env.BOUNDARY_ROOT ?? fileURLToPath(new URL('../../', import.meta.url))
const problems = []

function walk(dir) {
  const out = []
  let entries = []
  try {
    entries = readdirSync(dir)
  } catch {
    return out
  }
  for (const name of entries) {
    const full = join(dir, name)
    const st = statSync(full)
    if (st.isDirectory()) out.push(...walk(full))
    else if (/\.(?:[cm]?[jt]sx?)$/.test(name)) out.push(full)
  }
  return out
}

// Import specifiers of every form: import x from '..', import '..', export ... from '..', import('..'), require('..')
const SPECIFIER = /(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s+|\brequire\s*\(\s*)(['"`])([^'"`\n]+)\1/g

function specifiers(text) {
  const found = []
  for (const m of text.matchAll(SPECIFIER)) found.push(m[2])
  return found
}

const rel = (f) => relative(root, f).split(sep).join('/')

// 1. src/ never imports server/ or api/
for (const file of walk(join(root, 'src'))) {
  const text = readFileSync(file, 'utf8')
  for (const spec of specifiers(text)) {
    if (/(^|\/)(server|api)(\/|$)/.test(spec) || /^node:/.test(spec)) {
      problems.push(`${rel(file)}: src must not import "${spec}"`)
    }
  }
  if (/process\.env/.test(text)) problems.push(`${rel(file)}: src must not reference process.env`)
}

// 2. shared/ is isomorphic and never reads env
for (const file of walk(join(root, 'shared'))) {
  if (/\.test\.[cm]?[jt]s$/.test(file)) continue
  const text = readFileSync(file, 'utf8')
  for (const spec of specifiers(text)) {
    if (/^node:/.test(spec) || (!spec.startsWith('./') && !spec.startsWith('../'))) {
      problems.push(`${rel(file)}: shared must not import "${spec}"`)
    }
    if (/(^|\/)(server|api|src)(\/|$)/.test(spec)) {
      problems.push(`${rel(file)}: shared must not import "${spec}"`)
    }
  }
  if (/process\.env|import\.meta\.env|\bBuffer\b|\bwindow\b|\bdocument\b/.test(text)) {
    problems.push(`${rel(file)}: shared must not read env or use DOM/Node globals`)
  }
}

// 2b. Function code (api/, server/, shared/) uses the standard TypeScript-ESM convention: every
//     relative import specifier ends in ".js" (it points at the .ts source). Vercel compiles .ts to
//     .js without rewriting specifiers, so a ".ts" or extensionless relative import crashes the
//     function at runtime with ERR_MODULE_NOT_FOUND.
for (const dir of ['api', 'server', 'shared']) {
  for (const file of walk(join(root, dir))) {
    if (!/\.[cm]?ts$/.test(file)) continue
    if (rel(file) === 'server/scripts/check-boundaries.test.ts') continue // its fixtures contain sample specifiers
    for (const spec of specifiers(readFileSync(file, 'utf8'))) {
      if (!(spec.startsWith('./') || spec.startsWith('../'))) continue
      if (!spec.endsWith('.js')) problems.push(`${rel(file)}: relative import "${spec}" must end in .js`)
    }
  }
}

// 3. Secret-looking strings in src/, shared/, api/, server/, vercel.json, .env.example
const SECRET_PATTERNS = [
  [/\bre_[A-Za-z0-9_]{16,}/, 'Resend-style key'],
  [/\b0x4[A-Za-z0-9_-]{20,}/, 'Turnstile production-style key'],
  [/RESEND_API_KEY[ \t]*=[ \t]*[^\s#]/, 'RESEND_API_KEY with a value'],
  [/TURNSTILE_SECRET(_KEY)?[ \t]*=[ \t]*[^\s#]/, 'Turnstile secret with a value'],
  [/x-vercel-protection-bypass/i, 'protection bypass header'],
]
const scanTargets = [
  ...walk(join(root, 'src')),
  ...walk(join(root, 'shared')),
  ...walk(join(root, 'api')),
  ...walk(join(root, 'server')).filter((f) => !rel(f).startsWith('server/scripts/')),
  join(root, 'vercel.json'),
  join(root, '.env.example'),
]
for (const file of scanTargets) {
  let text = ''
  try {
    text = readFileSync(file, 'utf8')
  } catch {
    continue
  }
  // Tests legitimately contain fake placeholder strings; they are scanned separately by name only.
  if (/\.test\.[cm]?[jt]s$/.test(file)) continue
  for (const [re, label] of SECRET_PATTERNS) {
    if (re.test(text)) problems.push(`${rel(file)}: looks like a secret (${label})`)
  }
}

// 4. Only allowlisted VITE_* names may exist (a VITE_ prefix ships the value to the browser).
//    Flags any other VITE_* name in .env.example and in source references under src/.
const VITE_ALLOWLIST = new Set(['VITE_TURNSTILE_SITE_KEY', 'VITE_SHOW_TODOS'])
const viteTargets = [...walk(join(root, 'src')), join(root, '.env.example')]
for (const file of viteTargets) {
  let text = ''
  try {
    text = readFileSync(file, 'utf8')
  } catch {
    continue
  }
  for (const m of text.matchAll(/\bVITE_[A-Z0-9_]+/g)) {
    if (!VITE_ALLOWLIST.has(m[0])) problems.push(`${rel(file)}: VITE_ variable "${m[0]}" is not in the allowlist (${[...VITE_ALLOWLIST].join(', ')})`)
  }
}

try {
  const vercel = JSON.parse(readFileSync(join(root, 'vercel.json'), 'utf8'))
  for (const key of ['env', 'build']) {
    if (key in vercel) problems.push(`vercel.json: must not contain "${key}" (secrets live in the Vercel dashboard)`)
  }
} catch {
  /* vercel.json absent or unreadable: nothing to check */
}

if (problems.length > 0) {
  console.error('Boundary check FAILED:')
  for (const p of problems) console.error('  - ' + p)
  process.exit(1)
}
console.log('Boundary check passed: src does not import server/api, shared is isomorphic, no secret-looking strings.')
