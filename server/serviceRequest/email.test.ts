import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { validateServiceRequest } from '../../shared/serviceRequest.js'
import type { ServiceRequest } from '../../shared/serviceRequest.js'
import {
  buildSubject,
  composeEmail,
  escapeHtml,
  formatQatar,
  formatUtc,
  PRIVACY_NOTE_VERSION,
  sanitizeForSubject,
  UNTRUSTED_NOTICE,
} from './email.js'
import { CRLF, FIXED_NOW, FROM, REAL_INBOX, u, validBody } from './test-helpers.js'

function value(over: Record<string, unknown> = {}): ServiceRequest {
  const r = validateServiceRequest(validBody(over))
  assert.ok(r.ok, JSON.stringify(r))
  return r.value
}

function compose(over: Record<string, unknown> = {}, production = true, now: Date = FIXED_NOW) {
  return composeEmail({
    value: value(over),
    reference: 'SR-3F9A21BC',
    now,
    from: FROM,
    to: REAL_INBOX,
    idempotencyKey: 'sr-3f9a21bc-1111-4222-8333-444455556666',
    production,
  })
}

const TEMPLATE_TAGS = /<\/?(?:html|head|meta|body|table|tr|td|div|br)\b[^>]*>/gi

describe('escapeHtml', () => {
  it('escapes & < > " \' and nothing else', () => {
    assert.equal(escapeHtml(`&<>"'`), '&amp;&lt;&gt;&quot;&#39;')
    assert.equal(escapeHtml('plain text 123 ' + u(0x0627)), 'plain text 123 ' + u(0x0627))
  })
  it('does not double-escape in a way that reopens a tag', () => {
    assert.equal(escapeHtml('&lt;script&gt;'), '&amp;lt;script&amp;gt;')
  })
})

describe('subject', () => {
  it('lists services in canonical order with the business name', () => {
    assert.equal(buildSubject(value({ services: ['logo', 'website'] }), true), 'New service request: Website, Logo - Acme Coffee Roasters')
    assert.equal(buildSubject(value({ services: ['branding'] }), true), 'New service request: Business branding - Acme Coffee Roasters')
  })
  it('[TEST] prefix only off production', () => {
    assert.ok(buildSubject(value(), false).startsWith('[TEST] New service request:'))
    assert.ok(!buildSubject(value(), true).includes('[TEST]'))
  })
  it('caps the business name at 60 characters with an ellipsis, and the whole subject at 150', () => {
    const long = 'B'.repeat(120)
    const s = buildSubject(value({ business_name: long }), true)
    assert.ok(s.endsWith('B'.repeat(59) + String.fromCharCode(0x2026)))
    assert.ok(Array.from(buildSubject(value({ business_name: long }), false)).length <= 150)
    assert.equal(sanitizeForSubject('B'.repeat(60)), 'B'.repeat(60))
    assert.equal(sanitizeForSubject('B'.repeat(61)), 'B'.repeat(59) + String.fromCharCode(0x2026))
  })
  it('sanitizeForSubject removes CR, LF, controls, LS, PS, NEL, NUL, bidi and tag characters', () => {
    const dirty = 'A' + CRLF + 'B' + u(0x2028, 0x2029, 0x85, 0, 0x202e, 0xe0041, 0x200b, 7, 0x7f) + 'C'
    assert.equal(sanitizeForSubject(dirty), 'A B C')
  })
  it('bounds the input before any regex (a 1 MB string is handled)', () => {
    const t0 = performance.now()
    sanitizeForSubject('x'.repeat(1_000_000))
    assert.ok(performance.now() - t0 < 100)
  })
})

describe('timestamps', () => {
  it('prints UTC and Asia/Qatar for a fixed clock', () => {
    assert.equal(formatUtc(new Date('2026-10-28T14:03:22Z'), 'second'), '2026-10-28 14:03:22')
    assert.equal(formatQatar(new Date('2026-10-28T14:03:22Z'), 'second'), '2026-10-28 17:03:22')
  })
  it('rolls the date over: UTC 22:30 is the next day in Qatar', () => {
    assert.equal(formatUtc(new Date('2026-10-28T22:30:05Z'), 'second'), '2026-10-28 22:30:05')
    assert.equal(formatQatar(new Date('2026-10-28T22:30:05Z'), 'second'), '2026-10-29 01:30:05')
  })
  it('uses a 24-hour clock at midnight and across a year boundary', () => {
    assert.equal(formatUtc(new Date('2026-12-31T00:00:00Z'), 'second'), '2026-12-31 00:00:00')
    assert.equal(formatQatar(new Date('2026-12-31T21:00:00Z'), 'second'), '2027-01-01 00:00:00')
  })
  it('minute precision drops the seconds', () => {
    assert.equal(formatUtc(new Date('2026-10-28T14:03:22Z'), 'minute'), '2026-10-28 14:03')
  })
})

describe('composeEmail', () => {
  it('envelope: from, a single to, bare reply-to, idempotency key', () => {
    const m = compose()
    assert.equal(m.from, FROM)
    assert.equal(m.to, REAL_INBOX)
    assert.equal(m.replyTo, 'amira@acmecoffee.example')
    assert.equal(m.idempotencyKey, 'sr-3f9a21bc-1111-4222-8333-444455556666')
  })
  it('reply-to is the bare address even when the name looks like an address', () => {
    const m = compose({ name: 'ceo@bank.example' })
    assert.equal(m.replyTo, 'amira@acmecoffee.example')
  })
  it('first line of the text part and first row of the HTML part is the untrusted-content notice', () => {
    const m = compose()
    assert.equal(m.text.split('\n')[0], UNTRUSTED_NOTICE)
    assert.ok(m.html.indexOf(UNTRUSTED_NOTICE) > 0)
    assert.ok(m.html.indexOf(UNTRUSTED_NOTICE) < m.html.indexOf('NEW SERVICE REQUEST'))
  })
  it('renders the example layout (ARCHITECTURE 6.5)', () => {
    const m = compose({ description: 'Line one of the project.\nLine two.', links: 'acmecoffee.example\ninstagram.com/acme' })
    assert.equal(
      m.text,
      [
        UNTRUSTED_NOTICE,
        '',
        'NEW SERVICE REQUEST',
        '  Reference:            SR-3F9A21BC',
        '',
        'SUBMITTED',
        '  UTC:                  2026-10-28 14:03',
        '  Qatar:                2026-10-28 17:03 (Asia/Qatar, UTC+03:00)',
        '',
        'CONTACT',
        '  Name:                 > Amira Haddad',
        '  Email:                > amira@acmecoffee.example',
        '  Phone:                Not provided',
        '  Business name:        > Acme Coffee Roasters',
        '',
        'REQUEST',
        '  Services:             Website, Logo',
        '  Timeline:             Within 1 to 3 months',
        '  Heard about us via:   > A friend who runs a bakery',
        '',
        'PROJECT DESCRIPTION',
        '> Line one of the project.',
        '> Line two.',
        '',
        'LINKS',
        '> 1. https://acmecoffee.example/',
        '> 2. https://instagram.com/acme',
        '',
        'CONSENT',
        '  Agreed to the privacy note on 2026-10-28 14:03 UTC',
        '  Privacy note version: ' + PRIVACY_NOTE_VERSION,
        '',
        'Reply to this email to answer the sender (Reply-To is their address).',
        '',
      ].join('\n'),
    )
  })
  it('every label is present, and empty optional values print "Not provided"', () => {
    const m = compose({ phone: '', timeline: '', referral_source: '', links: '' })
    for (const label of ['Reference:', 'UTC:', 'Qatar:', 'Name:', 'Email:', 'Phone:', 'Business name:', 'Services:', 'Timeline:', 'Heard about us via:', 'PROJECT DESCRIPTION', 'LINKS', 'CONSENT', 'Privacy note version:']) {
      assert.ok(m.text.includes(label), label)
      assert.ok(m.html.includes(label.replace(':', '')), 'html ' + label)
    }
    assert.equal(m.text.match(/Not provided/g)?.length, 4)
    assert.equal(m.html.match(/Not provided/g)?.length, 4)
  })
  it('the privacy-note version and consent lines are in both parts', () => {
    const m = compose()
    assert.match(m.text, new RegExp('Privacy note version: ' + PRIVACY_NOTE_VERSION))
    assert.ok(m.html.includes('Privacy note version'))
    assert.ok(m.html.includes(PRIVACY_NOTE_VERSION))
    assert.ok(m.text.includes('Agreed to the privacy note on 2026-10-28 14:03 UTC'))
  })
  it('Name and Email are separate plain lines', () => {
    const lines = compose({ name: 'amira@evil.example' }).text.split('\n')
    assert.ok(lines.some((l) => /^ {2}Name: +> amira@evil\.example$/.test(l)))
    assert.ok(lines.some((l) => /^ {2}Email: +> amira@acmecoffee\.example$/.test(l)))
  })
  it('every user line carries the "> " marker; a description cannot forge a section or a header', () => {
    const m = compose({ description: 'CONSENT\nReference: SR-FAKE0000\nSUBMITTED\nBcc: x@evil.test\nReply-To: y@evil.test' })
    const lines = m.text.split('\n')
    for (const forged of ['CONSENT', 'Reference: SR-FAKE0000', 'SUBMITTED', 'Bcc: x@evil.test', 'Reply-To: y@evil.test']) {
      assert.ok(lines.includes('> ' + forged), 'marked: ' + forged)
      // The genuine headings appear exactly once, unmarked; forged copies never appear unmarked.
      assert.equal(lines.filter((l) => l === forged).length, forged === 'CONSENT' || forged === 'SUBMITTED' ? 1 : 0, 'unmarked line: ' + forged)
    }
  })
  it('user-supplied single-line values sit after their label with the marker', () => {
    const m = compose({ referral_source: 'x' + CRLF + 'Bcc: attacker@example.test' })
    assert.ok(m.text.includes('  Heard about us via:   > x Bcc: attacker@example.test\n'))
    assert.ok(!/^Bcc:/m.test(m.text))
  })
  it('a user value that equals "Not provided" still carries the marker', () => {
    const m = compose({ phone: '', business_name: 'Not provided' })
    assert.ok(m.text.includes('> Not provided'))
  })
  it('links are plain escaped text, never anchors', () => {
    const m = compose({ links: 'acmecoffee.example/path?a=1&b=2' })
    assert.ok(!m.html.includes('<a'))
    assert.ok(!m.html.includes('href'))
    assert.ok(m.html.includes('1. https://acmecoffee.example/path?a=1&amp;b=2'))
  })
  it('escaping: stripping the template tags leaves no < or > from user input', () => {
    const evil = `<script>alert(1)</script> & "q" 'a' <img src=x onerror=1> </td></tr>`
    const m = compose({ name: evil, business_name: evil, referral_source: evil, description: evil + ' and more text to be long enough.', links: 'example.com/a' })
    const stripped = m.html.replace(/<!doctype html>/i, '').replace(TEMPLATE_TAGS, '')
    assert.ok(!stripped.includes('<'))
    assert.ok(!stripped.includes('>'))
    assert.ok(stripped.includes('&lt;script&gt;alert(1)&lt;/script&gt; &amp; &quot;q&quot; &#39;a&#39;'))
    assert.ok(!m.html.includes('<script'))
    assert.ok(!m.html.includes('<img'))
  })
  it('<br> is added after escaping, one per description line', () => {
    const m = compose({ description: '<b>one</b> two three four five\nsecond line is here' })
    assert.ok(m.html.includes('&gt;&lt;b&gt;') === false)
    assert.ok(m.html.includes('&lt;b&gt;one&lt;/b&gt; two three four five<br>second line is here'))
  })
  it('the HTML uses inline styles only, no remote resources, no tracking pixel, no style or script element', () => {
    const m = compose()
    assert.ok(!/<(?:style|script|link|img|iframe|object|embed|form|input|base)\b/i.test(m.html))
    assert.ok(!/(?:src|href)\s*=/i.test(m.html))
    assert.ok(!/https?:\/\/(?!acmecoffee)/.test(m.html.replace(/https:\/\/acmecoffee\.example\/?/g, '')))
  })
  it('right-to-left input renders: value cells carry dir="auto"', () => {
    const m = compose({ name: u(0x0623, 0x0645, 0x064a, 0x0631, 0x0629) })
    assert.ok(m.html.includes('dir="auto"'))
    assert.ok(m.html.includes(u(0x0623, 0x0645, 0x064a, 0x0631, 0x0629)))
  })
  it('contains no IP, user agent, referrer or Origin field', () => {
    const m = compose()
    assert.doesNotMatch(m.text, /\b(?:IP|User-Agent|Referer|Referrer|Origin)\b/i)
    assert.doesNotMatch(m.html, /\b(?:IP address|User-Agent|Referer|Referrer|Origin)\b/i)
  })
  it('a timestamp is taken from the injected clock only', () => {
    const m = compose({}, true, new Date('2026-10-28T22:30:05Z'))
    assert.ok(m.text.includes('2026-10-28 22:30'))
    assert.ok(m.text.includes('2026-10-29 01:30 (Asia/Qatar, UTC+03:00)'))
  })
})
