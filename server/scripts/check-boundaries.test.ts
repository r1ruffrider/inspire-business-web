import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'

const script = fileURLToPath(new URL('./check-boundaries.mjs', import.meta.url))

function run(files: Record<string, string>): { code: number | null; out: string } {
  const root = mkdtempSync(join(tmpdir(), 'boundary-'))
  try {
    for (const [rel, text] of Object.entries(files)) {
      const full = join(root, rel)
      mkdirSync(join(full, '..'), { recursive: true })
      writeFileSync(full, text)
    }
    const r = spawnSync(process.execPath, [script], { env: { ...process.env, BOUNDARY_ROOT: root + '/' }, encoding: 'utf8' })
    return { code: r.status, out: r.stdout + r.stderr }
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
}

describe('boundary check script', () => {
  it('passes on a clean tree', () => {
    const r = run({ 'src/App.tsx': "import { validateServiceRequest } from '../shared/serviceRequest.ts'\n", 'shared/serviceRequest.ts': 'export const a = 1\n' })
    assert.equal(r.code, 0, r.out)
  })
  for (const [label, text] of [
    ['static import of server', "import { h } from '../server/serviceRequest/handler.ts'\n"],
    ['import of api', "import h from '../api/service-request.ts'\n"],
    ['dynamic import of server', "const m = await import('../../server/x.ts')\n"],
    ['re-export from server', "export * from '../server/x.ts'\n"],
    ['bare side-effect import', "import '../server/x.ts'\n"],
    ['node builtin in src', "import { createHash } from 'node:crypto'\n"],
    ['process.env in src', 'const k = process.env.SECRET\n'],
  ] as const) {
    it(`fails on ${label} in src/`, () => {
      const r = run({ 'src/bad.ts': text })
      assert.equal(r.code, 1, r.out)
    })
  }
  it('fails when shared/ reads env or imports Node/outside', () => {
    assert.equal(run({ 'shared/a.ts': 'export const x = process.env.A\n' }).code, 1)
    assert.equal(run({ 'shared/a.ts': 'export const x = import.meta.env.A\n' }).code, 1)
    assert.equal(run({ 'shared/a.ts': "import { x } from 'node:fs'\n" }).code, 1)
    assert.equal(run({ 'shared/a.ts': "import { x } from '../server/y.ts'\n" }).code, 1)
    assert.equal(run({ 'shared/a.ts': "import { x } from 'zod'\n" }).code, 1)
  })
  it('N8: only VITE_TURNSTILE_SITE_KEY and VITE_SHOW_TODOS are allowed, in src/ and .env.example', () => {
    assert.equal(run({ 'src/a.ts': 'const k = import.meta.env.VITE_TURNSTILE_SITE_KEY + import.meta.env.VITE_SHOW_TODOS\n' }).code, 0)
    assert.equal(run({ '.env.example': 'VITE_TURNSTILE_SITE_KEY=\nVITE_SHOW_TODOS=\n' }).code, 0)
    assert.equal(run({ 'src/a.ts': 'const k = import.meta.env.VITE_RESEND_API_KEY\n' }).code, 1)
    assert.equal(run({ 'src/a.ts': 'const k = import.meta.env.VITE_SECRET\n' }).code, 1)
    assert.equal(run({ '.env.example': 'VITE_API_TOKEN=\n' }).code, 1)
    assert.equal(run({ '.env.example': 'VITE_TURNSTILE_SITE_KEY_2=\n' }).code, 1)
  })
  it('fails on a secret-looking string and on an env key in vercel.json', () => {
    assert.equal(run({ 'src/a.ts': "const k = 're_' + 'x'\nconst s = 're_abcdefghijklmnop1234'\n" }).code, 1)
    assert.equal(run({ 'src/a.ts': "const s = '0x4AAAAAAAabcdefghijklmnopqrstuv'\n" }).code, 1)
    assert.equal(run({ '.env.example': 'RESEND_API_KEY=abc\n' }).code, 1)
    assert.equal(run({ '.env.example': 'RESEND_API_KEY=\nTURNSTILE_SECRET_KEY=\n' }).code, 0)
    assert.equal(run({ 'vercel.json': '{"env":{"A":"b"}}' }).code, 1)
  })
})
