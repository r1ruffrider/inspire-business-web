import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  buildWireRequest,
  checkWireShape,
  countCodePoints,
  isIdempotencyKey,
  isValidAsciiEmail,
  LIMITS,
  PRIVACY_NOTE_VERSION,
  sanitizeSingleLine,
  validateField,
  validateServiceRequest,
  WIRE_KEYS,
} from './serviceRequest.ts'
import type { FieldError, ServiceRequest } from './serviceRequest.ts'

// Invisible and separator characters are built from code points: none is pasted into this file.
const u = (...codes: number[]): string => String.fromCodePoint(...codes)

function base(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    name: 'Amira Haddad',
    email: 'amira@acmecoffee.example',
    phone: '',
    business_name: 'Acme Coffee Roasters',
    services: ['website'],
    description: 'We need a new website for our coffee shop and online store.',
    links: '',
    timeline: '',
    referral_source: '',
    consent: true,
    homepage_url: '',
    turnstile_token: 't',
    ...over,
  }
}

function ok(over: Record<string, unknown> = {}): ServiceRequest {
  const r = validateServiceRequest(base(over))
  assert.ok(r.ok, 'expected ok, got ' + JSON.stringify(r))
  return r.value
}

function errors(over: Record<string, unknown>): FieldError[] {
  const r = validateServiceRequest(base(over))
  assert.ok(!r.ok, 'expected failure')
  return r.errors
}

function only(over: Record<string, unknown>): { field: string; code: string } {
  const e = errors(over)
  assert.equal(e.length, 1, JSON.stringify(e))
  return { field: e[0]!.field, code: e[0]!.code }
}

describe('output shape', () => {
  it('returns known keys only, in table order', () => {
    const v = ok()
    assert.deepEqual(Object.keys(v), ['name', 'email', 'phone', 'business_name', 'services', 'description', 'links', 'timeline', 'referral_source', 'consent'])
    assert.equal(v.consent, true)
    assert.deepEqual(v.links, [])
  })
  it('WIRE_KEYS is the allowlist: fields + homepage_url + turnstile_token', () => {
    assert.deepEqual([...WIRE_KEYS].sort(), ['business_name', 'consent', 'description', 'email', 'homepage_url', 'links', 'name', 'phone', 'referral_source', 'services', 'timeline', 'turnstile_token'])
  })
  it('does not pollute prototypes', () => {
    const r = validateServiceRequest(JSON.parse('{"__proto__":{"polluted":1}}'))
    assert.ok(!r.ok)
    assert.equal(({} as Record<string, unknown>).polluted, undefined)
  })
})

describe('unknown keys and shapes', () => {
  for (const key of ['__proto__', 'budget', 'to', 'bcc', 'cc', 'subject', 'constructor', 'toString', 'Name', 'name ']) {
    it(`rejects own key ${JSON.stringify(key)}`, () => {
      const input = JSON.parse(JSON.stringify(base())) as Record<string, unknown>
      Object.defineProperty(input, key, { value: 'x', enumerable: true, configurable: true, writable: true })
      const r = validateServiceRequest(input)
      assert.deepEqual(r, { ok: false, errors: [{ field: '_form', code: 'invalid' }] })
      assert.deepEqual(checkWireShape(input), { ok: false })
    })
  }
  for (const input of [null, undefined, 5, 'x', true, [], [base()]]) {
    it(`rejects non-object ${JSON.stringify(input)}`, () => {
      assert.deepEqual(validateServiceRequest(input), { ok: false, errors: [{ field: '_form', code: 'invalid' }] })
    })
  }
  it('a non-string honeypot is a shape failure; a missing one is only a wire-shape failure', () => {
    assert.deepEqual(validateServiceRequest(base({ homepage_url: 1 })).ok, false)
    const b = base()
    delete b.homepage_url
    assert.equal(validateServiceRequest(b).ok, true)
    assert.deepEqual(checkWireShape(b), { ok: false })
  })
  it('checkWireShape returns the honeypot and the token without validating the token type', () => {
    assert.deepEqual(checkWireShape(base({ homepage_url: 'x', turnstile_token: 5 })), { ok: true, honeypot: 'x', token: 5 })
    const b = base()
    delete b.turnstile_token
    assert.deepEqual(checkWireShape(b), { ok: true, honeypot: '', token: undefined })
  })
  it('services raw length over 6 fails the wire shape', () => {
    assert.deepEqual(checkWireShape(base({ services: Array.from({ length: 7 }, () => 'logo') })), { ok: false })
    assert.equal(checkWireShape(base({ services: Array.from({ length: 6 }, () => 'logo') })).ok, true)
  })
  it('does not coerce types', () => {
    assert.deepEqual(only({ consent: 'true' }), { field: 'consent', code: 'invalid' })
    assert.deepEqual(only({ consent: 1 }), { field: 'consent', code: 'invalid' })
    assert.deepEqual(only({ consent: false }), { field: 'consent', code: 'required' })
    assert.deepEqual(only({ name: 5 }), { field: 'name', code: 'invalid' })
    assert.deepEqual(only({ name: null }), { field: 'name', code: 'invalid' })
    assert.deepEqual(only({ services: 'website' }), { field: 'services', code: 'invalid' })
    assert.deepEqual(only({ services: [1] }), { field: 'services', code: 'invalid' })
    assert.deepEqual(only({ timeline: 3 }), { field: 'timeline', code: 'invalid' })
  })
})

describe('name, business name, referral source', () => {
  it('accepts one-letter, Arabic, Chinese, Devanagari and emoji names', () => {
    for (const n of ['A', u(0x0623, 0x0645, 0x064a, 0x0631, 0x0629), u(0x738b, 0x82b3), u(0x0905, 0x092e, 0x093f, 0x0924), 'Sam ' + u(0x1f600)]) {
      assert.equal(ok({ name: n }).name, n)
    }
  })
  it('100 code points pass and 101 fail, counting code points not UTF-16 units', () => {
    assert.equal(ok({ name: 'a'.repeat(100) }).name.length, 100)
    assert.deepEqual(only({ name: 'a'.repeat(101) }), { field: 'name', code: 'too_long' })
    const emoji100 = u(0x1f600).repeat(100)
    assert.equal(ok({ name: emoji100 }).name, emoji100)
    assert.deepEqual(only({ name: u(0x1f600).repeat(101) }), { field: 'name', code: 'too_long' })
  })
  it('empty and whitespace-only are required', () => {
    assert.deepEqual(only({ name: '' }), { field: 'name', code: 'required' })
    assert.deepEqual(only({ name: '   ' + u(9, 10, 13) + '  ' }), { field: 'name', code: 'required' })
    assert.deepEqual(only({ business_name: '' }), { field: 'business_name', code: 'required' })
  })
  it('business name 120 passes, 121 fails; referral 200 passes, 201 fails and is optional', () => {
    ok({ business_name: 'b'.repeat(120) })
    assert.deepEqual(only({ business_name: 'b'.repeat(121) }), { field: 'business_name', code: 'too_long' })
    ok({ referral_source: 'r'.repeat(200) })
    assert.deepEqual(only({ referral_source: 'r'.repeat(201) }), { field: 'referral_source', code: 'too_long' })
    assert.equal(ok({ referral_source: '' }).referral_source, '')
  })
  it('collapses internal whitespace and trims', () => {
    assert.equal(ok({ name: '  Amira   ' + u(9) + ' Haddad  ' }).name, 'Amira Haddad')
  })
  it('validateField reports an exact count for an oversized value', () => {
    assert.deepEqual(validateField('name', 'a'.repeat(130)), { field: 'name', code: 'too_long', count: 30 })
  })
})

describe('text pipeline (T1)', () => {
  it('turns every control character, DEL, C1, LS and PS into a space in single-line fields', () => {
    const controls = [0, 1, 7, 8, 9, 10, 11, 12, 13, 27, 31, 0x7f, 0x80, 0x85, 0x9f, 0x2028, 0x2029]
    for (const c of controls) {
      assert.equal(sanitizeSingleLine('a' + u(c) + 'b'), 'a b', 'U+' + c.toString(16))
    }
  })
  it('strips every Cf character except ZWNJ, ZWJ, LRM, RLM', () => {
    const stripped = [0x202a, 0x202b, 0x202c, 0x202d, 0x202e, 0x2066, 0x2067, 0x2068, 0x2069, 0x061c, 0x2060, 0x2061, 0x2062, 0x2063, 0x2064, 0x00ad, 0xfeff, 0x200b, 0xe0001, 0xe0041, 0xe007f, 0xe0000]
    for (const c of stripped) {
      assert.equal(sanitizeSingleLine('a' + u(c) + 'b'), 'ab', 'U+' + c.toString(16))
    }
    for (const c of [0x200c, 0x200d, 0x200e, 0x200f]) {
      assert.equal(sanitizeSingleLine('a' + u(c) + 'b'), 'a' + u(c) + 'b', 'kept U+' + c.toString(16))
    }
  })
  it('keeps emoji ZWJ sequences and Persian ZWNJ intact', () => {
    const family = u(0x1f468, 0x200d, 0x1f469, 0x200d, 0x1f467)
    assert.equal(ok({ name: family }).name, family)
    const persian = u(0x0645, 0x06cc, 0x200c, 0x062e, 0x0648, 0x0627, 0x0647, 0x0645)
    assert.equal(ok({ name: persian }).name, persian)
  })
  it('replaces lone surrogates with U+FFFD', () => {
    assert.equal(sanitizeSingleLine('a' + String.fromCharCode(0xd800) + 'b'), 'a' + u(0xfffd) + 'b')
    assert.equal(sanitizeSingleLine(String.fromCharCode(0xdc00) + 'b'), u(0xfffd) + 'b')
  })
  it('multi-line: LF kept, CRLF and CR become LF, tab becomes a space, other controls a space', () => {
    const d = ok({ description: 'Line one is here' + u(13, 10) + 'Line' + u(9) + 'two' + u(13) + 'Line' + u(0) + 'three, long enough' }).description
    assert.equal(d, 'Line one is here\nLine two\nLine three, long enough')
  })
  it('counter equals the server count for CRLF, emoji and stripped characters', () => {
    const text = 'a'.repeat(10) + u(13, 10) + u(0x1f600).repeat(5) + u(0x202e) + 'b'.repeat(3)
    // 10 + LF + 5 emoji + 3 = 19 code points
    assert.equal(countCodePoints(text), 19)
    const full = text + 'c'.repeat(5)
    assert.equal(countCodePoints(full), ok({ description: full }).description.length - 5)
    assert.equal(countCodePoints('  hi  '), 2)
  })
  it('a 50 KB string of a plus @ is rejected in the email field and everywhere else under 100 ms', () => {
    const big = 'a'.repeat(50 * 1024) + '@'
    const t0 = performance.now()
    const r = validateServiceRequest(base({ name: big, email: big, phone: big, business_name: big, description: big, links: big, referral_source: big }))
    const dt = performance.now() - t0
    assert.ok(!r.ok)
    assert.ok(dt < 100, 'took ' + dt + ' ms')
    assert.ok(r.errors.every((e) => e.code === 'too_long'))
  })
  it('a 50 KB description in exact (client) mode reports the exact count', () => {
    const t0 = performance.now()
    const r = validateServiceRequest(base({ description: 'a'.repeat(50000) }), { exact: true })
    assert.ok(performance.now() - t0 < 100)
    assert.ok(!r.ok)
    assert.deepEqual(r.errors, [{ field: 'description', code: 'too_long', count: 48000 }])
  })
})

describe('email', () => {
  it('accepts plus tags, mixed-case local part (preserved), uppercase domain (lowercased), xn-- TLDs', () => {
    assert.equal(ok({ email: 'Amira.H+tag@Sub.AcmeCoffee.Example' }).email, 'Amira.H+tag@sub.acmecoffee.example')
    assert.equal(ok({ email: 'a@b.xn--mgbaam7a8h' }).email, 'a@b.xn--mgbaam7a8h')
    assert.equal(ok({ email: 'user@xn--bcher-kva.example' }).email, 'user@xn--bcher-kva.example')
    assert.equal(ok({ email: "o'brien@example.co.uk" }).email, "o'brien@example.co.uk")
  })
  it('trims only surrounding whitespace', () => {
    assert.equal(ok({ email: '  a@example.com  ' }).email, 'a@example.com')
    assert.equal(ok({ email: 'a@example.com' + u(13, 10) }).email, 'a@example.com')
  })
  const bad = [
    'plain', '@example.com', 'a@', 'a@b', 'a@b.c', 'a@.example.com', 'a@example..com', 'a@example.com.', '.a@example.com', 'a.@example.com', 'a..b@example.com',
    '"quoted"@example.com', 'a b@example.com', '<a@example.com>', 'a@example.com>', 'a,b@example.com', 'a;b@example.com', 'a@b@example.com', 'a(b)@example.com', 'a\\b@example.com',
    'a@exa mple.com', 'a@-example.com', 'a@example-.com', 'a@example.123', 'a@[127.0.0.1]', 'a@example.com, b@example.com', 'Name <a@example.com>',
    'a@exam_ple.com', 'a@example.c' + u(0x00f6) + 'm', u(0x00fc) + 'ser@example.com', 'a@' + u(0x00fc) + 'ber.com',
  ]
  for (const e of bad) {
    it(`rejects ${JSON.stringify(e)}`, () => {
      assert.deepEqual(only({ email: e }), { field: 'email', code: 'invalid' })
    })
  }
  it('N1: rejects backtick, { , | and the sequence =? in the local part', () => {
    for (const e of ['a`b@example.com', 'a{b@example.com', 'a|b@example.com', '{a@example.com', 'a=?utf-8?q?x@example.com', 'x=?@example.com', '=?x@example.com', 'a|@example.com']) {
      assert.deepEqual(only({ email: e }), { field: 'email', code: 'invalid' }, e)
      assert.equal(isValidAsciiEmail(e), false, e)
    }
  })
  it('N1: keeps apostrophe, %, a lone = or ?, }, ~ and other legitimate characters', () => {
    for (const e of ["o'brien@example.com", 'a%b@example.com', 'a=b@example.com', 'a?b@example.com', 'a}b@example.com', 'a~b@example.com', 'first.last+tag@example.com', 'a&b@example.com', 'a/b@example.com']) {
      assert.equal(ok({ email: e }).email, e, e)
    }
  })
  it('rejects a control or Cf character INSIDE the address instead of stripping it', () => {
    for (const c of [0, 9, 10, 13, 0x7f, 0x85, 0x2028, 0x200b, 0x200d, 0x202e, 0x061c, 0xfeff, 0xe0041]) {
      assert.deepEqual(only({ email: 'a' + u(c) + 'b@example.com' }), { field: 'email', code: 'invalid' }, 'U+' + c.toString(16))
      assert.deepEqual(only({ email: 'ab@exam' + u(c) + 'ple.com' }), { field: 'email', code: 'invalid' }, 'domain U+' + c.toString(16))
    }
    assert.deepEqual(only({ email: 'a' + u(13, 10) + 'Bcc: x@evil.test@example.com' }), { field: 'email', code: 'invalid' })
  })
  it('254 characters pass, 255 fail; empty is required', () => {
    const local = 'a'.repeat(64)
    const domain = ['b'.repeat(63), 'c'.repeat(63), 'd'.repeat(57), 'com'].join('.')
    const e254 = local + '@' + domain
    assert.equal(e254.length, 254)
    ok({ email: e254 })
    assert.deepEqual(only({ email: e254 + 'x' }), { field: 'email', code: 'too_long' })
    assert.deepEqual(only({ email: '' }), { field: 'email', code: 'required' })
  })
  it('isValidAsciiEmail is exported for config', () => {
    assert.equal(isValidAsciiEmail('info@inspirebusinesstechnology.com'), true)
    assert.equal(isValidAsciiEmail('a@b.c'), false)
  })
})

describe('privacy note version', () => {
  it('is exported for the page and is a dated, suffixed string', () => {
    assert.match(PRIVACY_NOTE_VERSION, /^[0-9]{4}-[0-9]{2}-[0-9]{2}([.][0-9]+)?$/)
    assert.equal(PRIVACY_NOTE_VERSION, '2026-10-28.2')
  })
})

describe('phone', () => {
  it('is optional', () => {
    assert.equal(ok({ phone: '' }).phone, '')
    assert.equal(ok({ phone: '   ' }).phone, '')
  })
  it('accepts international formats and extensions; stores the cleaned original text', () => {
    for (const p of ['+974 5555 1234', '(555) 123-4567', '555.123.4567', '+1 (555) 123-4567 x123', '5551234567 ext 99', '1234567', '123456789012345']) {
      assert.equal(ok({ phone: p }).phone, p)
    }
  })
  for (const p of ['abc', '12345', '1234567890123456', '+', '555-CALL-NOW', '+974 5555 1234 x', '5551234567 x1234567', '++9741234567', '12 34 56 7 ext']) {
    it(`rejects ${JSON.stringify(p)}`, () => {
      assert.deepEqual(only({ phone: p }), { field: 'phone', code: 'invalid' })
    })
  }
  it('rejects over 30 characters', () => {
    assert.deepEqual(only({ phone: '1'.repeat(31) }), { field: 'phone', code: 'too_long' })
  })
})

describe('services and timeline', () => {
  it('de-duplicates and orders canonically', () => {
    assert.deepEqual(ok({ services: ['branding', 'website', 'branding', 'logo'] }).services, ['website', 'logo', 'branding'])
  })
  it('requires at least one, rejects unknown values, rejects more than 6 raw', () => {
    assert.deepEqual(only({ services: [] }), { field: 'services', code: 'required' })
    assert.deepEqual(only({ services: ['seo'] }), { field: 'services', code: 'not_allowed' })
    assert.deepEqual(only({ services: ['Website'] }), { field: 'services', code: 'not_allowed' })
    assert.deepEqual(only({ services: ['website', 'x'.repeat(40)] }), { field: 'services', code: 'not_allowed' })
    assert.deepEqual(only({ services: Array.from({ length: 7 }, () => 'logo') }), { field: 'services', code: 'invalid' })
    assert.deepEqual(only({ services: Array.from({ length: 10 }, () => 'logo') }), { field: 'services', code: 'invalid' })
    ok({ services: Array.from({ length: 6 }, () => 'logo') })
  })
  it('timeline: empty or one of the four values', () => {
    for (const t of ['', 'asap', '1-3-months', 'flexible', 'unsure']) assert.equal(ok({ timeline: t }).timeline, t)
    assert.deepEqual(only({ timeline: 'next week' }), { field: 'timeline', code: 'not_allowed' })
    const noTimeline = base()
    delete noTimeline.timeline
    assert.equal(validateServiceRequest(noTimeline).ok, true)
  })
})

describe('description', () => {
  it('19 fails, 20 passes, 2000 passes, 2001 fails (counts included)', () => {
    assert.deepEqual(only({ description: 'a'.repeat(19) }), { field: 'description', code: 'too_short' })
    assert.deepEqual(validateField('description', 'a'.repeat(19)), { field: 'description', code: 'too_short', count: 1 })
    ok({ description: 'a'.repeat(20) })
    ok({ description: 'a'.repeat(2000) })
    assert.deepEqual(only({ description: 'a'.repeat(2001) }), { field: 'description', code: 'too_long' })
    assert.deepEqual(validateField('description', 'a'.repeat(2005)), { field: 'description', code: 'too_long', count: 5 })
  })
  it('counts code points: 2000 emoji pass, 2001 fail', () => {
    ok({ description: u(0x1f600).repeat(2000) })
    assert.deepEqual(only({ description: u(0x1f600).repeat(2001) }), { field: 'description', code: 'too_long' })
  })
  it('CRLF counts as one character', () => {
    const d = ('a' + u(13, 10)).repeat(1000)
    assert.equal(countCodePoints(d), 1999) // trailing newline trimmed
    ok({ description: d })
  })
  it('only whitespace is required, not too_short', () => {
    assert.deepEqual(only({ description: ' ' + u(10, 10, 13, 10) + '  ' }), { field: 'description', code: 'required' })
  })
  it('allows 5 URL-like substrings and rejects 6 with the excess count', () => {
    const urls = (n: number): string => 'See these examples: ' + Array.from({ length: n }, (_, i) => `https://e${i}.example`).join(' ') + ' thanks.'
    ok({ description: urls(5) })
    assert.deepEqual(only({ description: urls(6) }), { field: 'description', code: 'too_many' })
    assert.deepEqual(validateField('description', urls(9)), { field: 'description', code: 'too_many', count: 4 })
  })
  it('counts http://, https:// and www. case-insensitively; https://www. counts once', () => {
    const mix = 'Look at HTTP://a.example HtTpS://b.example www.c.example WWW.d.example https://www.e.example and more words here'
    ok({ description: mix }) // 5
    assert.deepEqual(only({ description: mix + ' www.f.example' }), { field: 'description', code: 'too_many' })
  })
  it('keeps tags as plain text (escaping happens at the email sink)', () => {
    assert.equal(ok({ description: 'Please make <b>bold</b> & "quoted" text work properly.' }).description, 'Please make <b>bold</b> & "quoted" text work properly.')
  })
})

describe('links', () => {
  it('is optional and normalises to absolute https URLs', () => {
    assert.deepEqual(ok({ links: '' }).links, [])
    assert.deepEqual(ok({ links: ' \n \n' }).links, [])
    assert.deepEqual(ok({ links: 'example.com\nwww.example.com/page\nhttps://Example.com/a?b=1#c\nhttp://example.org' }).links, [
      'https://example.com/',
      'https://www.example.com/page',
      'https://example.com/a?b=1#c',
      'http://example.org/',
    ])
  })
  it('accepts a port without a scheme and exposes punycode', () => {
    assert.deepEqual(ok({ links: 'example.com:8080/x' }).links, ['https://example.com:8080/x'])
    assert.deepEqual(ok({ links: u(0x0645, 0x062b, 0x0627, 0x0644) + '.com' }).links[0]!.startsWith('https://xn--'), true)
  })
  it('5 lines pass, 6 fail with the number to remove; blank lines do not count', () => {
    const lines = (n: number): string => Array.from({ length: n }, (_, i) => `site${i}.example`).join('\n\n')
    assert.equal(ok({ links: lines(5) }).links.length, 5)
    assert.deepEqual(only({ links: lines(6) }), { field: 'links', code: 'too_many' })
    assert.deepEqual(validateField('links', lines(8)), { field: 'links', code: 'too_many', count: 3 })
  })
  it('300 characters pass, 301 fail on the right line', () => {
    const pad = (n: number): string => 'https://example.com/' + 'a'.repeat(n - 20)
    assert.equal(pad(300).length, 300)
    ok({ links: pad(300) })
    assert.deepEqual(only({ links: pad(301) }), { field: 'links', code: 'too_long' })
    assert.deepEqual(validateField('links', 'example.com\n\n' + pad(305)), { field: 'links', code: 'too_long', line: 3, count: 5 })
  })
  it('rejects non-http schemes, credentials, bare words and bad hosts', () => {
    const bad: Array<[string, string]> = [
      ['javascript:alert(1)', 'bad_scheme'],
      ['JaVaScRiPt:alert(1)', 'bad_scheme'],
      ['data:text/html,<script>alert(1)</script>', 'bad_scheme'],
      ['ftp://example.com/f', 'bad_scheme'],
      ['mailto:a@example.com', 'bad_scheme'],
      ['file:///etc/passwd', 'bad_scheme'],
      ['https://user:pass@example.com', 'not_allowed'],
      ['http://user@example.com', 'not_allowed'],
      ['example', 'invalid'],
      ['hello world', 'invalid'],
      ['localhost', 'invalid'],
      ['http://localhost:3000', 'invalid'],
      ['http://127.0.0.1', 'invalid'],
      ['http://[::1]/', 'invalid'],
      ['http://192.168.1.1', 'invalid'],
      ['https://exa mple.com', 'invalid'],
      ['https://', 'invalid'],
      ['example.123', 'invalid'],
      ['http://.example.com', 'invalid'],
    ]
    for (const [link, code] of bad) {
      assert.deepEqual(only({ links: link }), { field: 'links', code }, link)
    }
  })
  it('reports the first bad line only, with its 1-based line number', () => {
    assert.deepEqual(validateField('links', 'good.example\nbad\nftp://x.example'), { field: 'links', code: 'invalid', line: 2 })
  })
})

describe('consent', () => {
  it('must be exactly true', () => {
    assert.equal(ok({ consent: true }).consent, true)
    assert.deepEqual(only({ consent: undefined }), { field: 'consent', code: 'required' })
  })
})

describe('validateField and error ordering', () => {
  it('validateField returns null for valid values and accepts the raw shapes of each control', () => {
    assert.equal(validateField('name', 'A'), null)
    assert.equal(validateField('services', ['logo']), null)
    assert.equal(validateField('consent', true), null)
    assert.equal(validateField('timeline', ''), null)
    assert.equal(validateField('links', ''), null)
  })
  it('collects every field error in table order', () => {
    const r = validateServiceRequest({ homepage_url: '' })
    assert.ok(!r.ok)
    assert.deepEqual(r.errors.map((e) => e.field), ['name', 'email', 'business_name', 'services', 'description', 'consent'])
  })
})

describe('client helpers', () => {
  it('buildWireRequest emits exactly the wire keys', () => {
    const w = buildWireRequest(
      { name: 'a', email: 'b', phone: '', business_name: 'c', services: ['logo'], description: 'd', links: '', timeline: '', referral_source: '', consent: true },
      { homepage_url: '', turnstile_token: 't' },
    )
    assert.deepEqual(Object.keys(w).sort(), [...WIRE_KEYS].sort())
  })
  it('isIdempotencyKey accepts UUID v4 only', () => {
    assert.equal(isIdempotencyKey('3f9a21bc-1111-4222-8333-444455556666'), true)
    assert.equal(isIdempotencyKey('3F9A21BC-1111-4222-B333-444455556666'), true)
    assert.equal(isIdempotencyKey('3f9a21bc-1111-1222-8333-444455556666'), false)
    assert.equal(isIdempotencyKey('3f9a21bc-1111-4222-c333-444455556666'), false)
    assert.equal(isIdempotencyKey(''), false)
    assert.equal(isIdempotencyKey(5), false)
    assert.equal(isIdempotencyKey('a'.repeat(5000)), false)
  })
  it('LIMITS match the UX spec', () => {
    assert.equal(LIMITS.name, 100)
    assert.equal(LIMITS.description.max, 2000)
    assert.equal(LIMITS.links.maxLines, 5)
  })
})
