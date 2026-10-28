import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { readConfig, TURNSTILE_TEST_SECRETS } from './config.js'
import type { Env } from './config.js'
import { CRLF, FROM, localEnv, prodEnv, previewEnv, REAL_INBOX, u } from './test-helpers.js'

function names(env: Env): { missing: string[]; invalid: string[]; events: string[] } {
  const r = readConfig(env)
  assert.ok(!r.ok, 'expected the config to be refused')
  return {
    missing: r.problems.filter((p) => p.event === 'config_missing').flatMap((p) => p.names),
    invalid: r.problems.filter((p) => p.event === 'config_invalid').flatMap((p) => p.names),
    events: r.problems.map((p) => p.event),
  }
}

describe('readConfig: valid configurations', () => {
  it('production', () => {
    const r = readConfig(prodEnv())
    assert.ok(r.ok)
    assert.equal(r.config.isProduction, true)
    assert.equal(r.config.allowLocalhost, false)
    assert.deepEqual([...r.config.allowedOrigins], ['https://www.inspirebusinesstechnology.com'])
    assert.deepEqual([...r.config.allowedHostnames], ['www.inspirebusinesstechnology.com'])
  })
  it('preview adds this deployment and the branch alias, and keeps ALLOWED_ORIGINS extras', () => {
    const r = readConfig(previewEnv({ ALLOWED_ORIGINS: 'https://staging.example.com' }))
    assert.ok(r.ok)
    assert.deepEqual([...r.config.allowedOrigins].sort(), [
      'https://site-abc123-team.vercel.app',
      'https://site-git-feature-pro-upgrade-team.vercel.app',
      'https://staging.example.com',
    ])
  })
  it('local dev with the log transport needs no Resend key and allows localhost', () => {
    const r = readConfig(localEnv())
    assert.ok(r.ok)
    assert.equal(r.config.mailTransport, 'log')
    assert.equal(r.config.allowLocalhost, true)
  })
  it('a documented test secret is fine outside production', () => {
    for (const secret of TURNSTILE_TEST_SECRETS) {
      assert.ok(readConfig(previewEnv({ TURNSTILE_SECRET_KEY: secret })).ok)
      assert.ok(readConfig(localEnv({ TURNSTILE_SECRET_KEY: secret })).ok)
    }
  })
})

describe('readConfig: refusals (names only, never values)', () => {
  it('missing required variables', () => {
    const env = prodEnv()
    delete env.TURNSTILE_SECRET_KEY
    delete env.MAIL_FROM
    delete env.MAIL_TO
    delete env.RESEND_API_KEY
    delete env.ALLOWED_ORIGINS
    assert.deepEqual(names(env).missing.sort(), ['ALLOWED_ORIGINS', 'MAIL_FROM', 'MAIL_TO', 'RESEND_API_KEY', 'TURNSTILE_SECRET_KEY'])
  })
  it('production needs ALLOWED_ORIGINS; preview does not', () => {
    assert.deepEqual(names(prodEnv({ ALLOWED_ORIGINS: '' })).missing, ['ALLOWED_ORIGINS'])
    assert.deepEqual(names(prodEnv({ ALLOWED_ORIGINS: ' , ,' })).missing, ['ALLOWED_ORIGINS'])
    assert.ok(readConfig(previewEnv()).ok)
  })
  it('MAIL_TO must be exactly one valid address', () => {
    const bad = [
      'a@example.com,b@example.com',
      'a@example.com;b@example.com',
      'a@example.com b@example.com',
      ' a@example.com',
      'a@example.com ',
      'Info <a@example.com>',
      '<a@example.com>',
      'a@example.com' + CRLF + 'Bcc: b@example.com',
      'a@example.com' + u(10),
      'not-an-address',
      'a@b',
      u(0x00fc) + '@example.com',
      '"a b"@example.com',
    ]
    for (const to of bad) {
      assert.ok(names(prodEnv({ MAIL_TO: to })).invalid.includes('MAIL_TO'), JSON.stringify(to))
    }
  })
  it('MAIL_FROM must be `Name <address>`; in production the address must be on the sending subdomain', () => {
    const bad = [
      'requests@send.inspirebusinesstechnology.com',
      'Inspire <requests@inspirebusinesstechnology.com>',
      'Inspire <requests@send.inspirebusinesstechnology.com.evil.test>',
      'Inspire <requests@evil.test>',
      'Inspire <a@b.c>',
      'Inspire <x@send.inspirebusinesstechnology.com>, Evil <e@evil.test>',
      'In' + CRLF + 'spire <requests@send.inspirebusinesstechnology.com>',
      '<requests@send.inspirebusinesstechnology.com>',
    ]
    for (const from of bad) {
      assert.ok(names(prodEnv({ MAIL_FROM: from })).invalid.includes('MAIL_FROM'), JSON.stringify(from))
    }
    assert.ok(readConfig(prodEnv({ MAIL_FROM: FROM })).ok)
    // Preview and local may use another domain, but still need the right shape.
    assert.ok(readConfig(previewEnv({ MAIL_FROM: 'Test <t@example.com>' })).ok)
    assert.ok(names(previewEnv({ MAIL_FROM: 'bad' })).invalid.includes('MAIL_FROM'))
  })
  it('MAIL_TRANSPORT=log is refused whenever VERCEL is set, and unknown transports are refused', () => {
    assert.ok(names(prodEnv({ MAIL_TRANSPORT: 'log' })).invalid.includes('MAIL_TRANSPORT'))
    assert.ok(names(previewEnv({ MAIL_TRANSPORT: 'log' })).invalid.includes('MAIL_TRANSPORT'))
    assert.ok(names(localEnv({ MAIL_TRANSPORT: 'smtp' })).invalid.includes('MAIL_TRANSPORT'))
    assert.ok(readConfig(prodEnv({ MAIL_TRANSPORT: 'resend' })).ok)
  })
  it('an unknown or missing VERCEL_ENV on Vercel is refused', () => {
    for (const v of ['development', 'staging', 'Production']) {
      assert.ok(names(prodEnv({ VERCEL_ENV: v })).invalid.includes('VERCEL_ENV'), v)
    }
    const env = prodEnv()
    delete env.VERCEL_ENV
    assert.ok(names(env).invalid.includes('VERCEL_ENV'))
  })
  it('VERCEL_ENV=production without VERCEL is not treated as production', () => {
    const r = readConfig(localEnv({ VERCEL_ENV: 'production' }))
    assert.ok(r.ok)
    assert.equal(r.config.isProduction, false)
  })
  it('a documented Turnstile test secret in production is refused', () => {
    for (const secret of TURNSTILE_TEST_SECRETS) {
      assert.deepEqual(names(prodEnv({ TURNSTILE_SECRET_KEY: secret })).invalid, ['TURNSTILE_SECRET_KEY'])
    }
  })
  it('ALLOWED_ORIGINS entries must be well-formed https origins without wildcards or paths', () => {
    const bad = [
      '*',
      'https://*.example.com',
      'http://www.example.com',
      'https://www.example.com/',
      'https://www.example.com/path',
      'www.example.com',
      'https://',
      'https://www.example.com, javascript:alert(1)',
      'https://WWW.example.com',
      'https://a..b.com',
      'https://www.example.com:99999999',
    ]
    for (const value of bad) {
      assert.ok(names(prodEnv({ ALLOWED_ORIGINS: value })).invalid.includes('ALLOWED_ORIGINS'), value)
    }
    const r = readConfig(prodEnv({ ALLOWED_ORIGINS: 'https://www.example.com, https://example.com:8443' }))
    assert.ok(r.ok)
    assert.deepEqual([...r.config.allowedHostnames].sort(), ['example.com', 'www.example.com'])
  })
  it('the preview rule: a real inbox is refused unless PREVIEW_ALLOW_REAL_INBOX is exactly 1', () => {
    const r = names(previewEnv({ MAIL_TO: REAL_INBOX }))
    assert.ok(r.events.includes('preview_real_inbox_refused'))
    assert.ok(readConfig(previewEnv({ MAIL_TO: REAL_INBOX, PREVIEW_ALLOW_REAL_INBOX: '1' })).ok)
    // The production deployment of course delivers to the real inbox.
    assert.ok(readConfig(prodEnv({ MAIL_TO: REAL_INBOX })).ok)
  })
  it('S1: on a preview ANY address on the company domain is refused unless the flag is exactly 1', () => {
    const company = [
      REAL_INBOX,
      'info+x@inspirebusinesstechnology.com',
      'other@inspirebusinesstechnology.com',
      'Info@InspireBusinessTechnology.COM',
      'someone@mail.inspirebusinesstechnology.com',
    ]
    for (const to of company) {
      const r = names(previewEnv({ MAIL_TO: to }))
      assert.ok(r.events.includes('preview_real_inbox_refused'), to)
      assert.ok(r.invalid.includes('MAIL_TO'), to)
      for (const flag of ['true', 'yes', '0', '']) {
        assert.ok(!readConfig(previewEnv({ MAIL_TO: to, PREVIEW_ALLOW_REAL_INBOX: flag })).ok, to + ' flag ' + flag)
      }
      assert.ok(readConfig(previewEnv({ MAIL_TO: to, PREVIEW_ALLOW_REAL_INBOX: '1' })).ok, to + ' flag 1')
    }
    // Look-alikes that are NOT on the company domain are fine.
    for (const to of ['info@inspirebusinesstechnology.com.evil.test', 'info@notinspirebusinesstechnology.com', 'delivered@resend.dev']) {
      assert.ok(readConfig(previewEnv({ MAIL_TO: to })).ok, to)
    }
    // Production and local are unaffected.
    assert.ok(readConfig(prodEnv({ MAIL_TO: 'other@inspirebusinesstechnology.com' })).ok)
    assert.ok(readConfig(localEnv({ MAIL_TO: 'other@inspirebusinesstechnology.com' })).ok)
  })
  it('problems never contain a configured value', () => {
    const secret = TURNSTILE_TEST_SECRETS[0] as string
    const env = prodEnv({ MAIL_TO: 'a@example.com,b@example.com', TURNSTILE_SECRET_KEY: secret, MAIL_TRANSPORT: 'log' })
    const r = readConfig(env)
    assert.ok(!r.ok)
    const text = JSON.stringify(r.problems)
    for (const v of ['a@example.com', secret, 'test-resend-key', 'inspirebusinesstechnology']) {
      assert.ok(!text.includes(v), v)
    }
  })
})
