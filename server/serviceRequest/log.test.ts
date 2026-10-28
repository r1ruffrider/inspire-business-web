import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { createLogger, errorNameOf } from './log.ts'

function capture(): { lines: string[]; log: ReturnType<typeof createLogger> } {
  const lines: string[] = []
  return { lines, log: createLogger((l) => lines.push(l)) }
}

describe('logger allowlist', () => {
  it('prints the event name and only allowlisted, well-formed fields', () => {
    const { lines, log } = capture()
    log('config_invalid', { names: ['MAIL_TO', 'not a name', 'lowercase', 'A'.repeat(65), 'SECRET=abc'] })
    log('turnstile_failed', { codes: ['timeout-or-duplicate', 'Bad Code', 'x@y.z'] })
    log('resend_error', { errorName: 'MailError', httpStatus: 500 })
    log('resend_error', { errorName: 'has spaces and a message', httpStatus: 1.5 })
    assert.deepEqual(lines.map((l) => JSON.parse(l)), [
      { event: 'config_invalid', names: ['MAIL_TO'] },
      { event: 'turnstile_failed', codes: ['timeout-or-duplicate'] },
      { event: 'resend_error', errorName: 'MailError', httpStatus: 500 },
      { event: 'resend_error' },
    ])
  })
  it('errorNameOf returns the class name and never the message or stack', () => {
    assert.equal(errorNameOf(new TypeError('secret value amira@x.test')), 'TypeError')
    assert.equal(errorNameOf(new DOMException('m', 'TimeoutError')), 'TimeoutError')
    assert.equal(errorNameOf('a thrown string with data'), 'UnknownError')
    assert.equal(errorNameOf(null), 'UnknownError')
    assert.equal(errorNameOf({ name: 'evil name with spaces' }), 'UnknownError')
  })
})
