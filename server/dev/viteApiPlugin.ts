/**
 * Dev-only Vite middleware: serves POST /api/service-request through the REAL handler.
 *
 * `apply: 'serve'` only (T15): it never runs in a build. envPrefix stays at Vite's default
 * (VITE_) in vite.config.ts. This plugin calls loadEnv(mode, root, '') which loads EVERY
 * variable, so that env object stays inside this file and is never passed to client code.
 *
 * Defaults (only used when .env.local / the shell do not set them): Cloudflare's always-pass
 * Turnstile TEST secret, MAIL_TRANSPORT=log (the composed mail is printed to this console, no
 * network), a Resend test recipient as MAIL_TO. VERCEL is unset here, so localhost origins and
 * the log transport are allowed.
 */
import { Readable } from 'node:stream'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { loadEnv } from 'vite'
import type { Plugin } from 'vite'

type Env = Record<string, string | undefined>

const DEV_DEFAULTS: Env = {
  // Cloudflare documented always-pass TEST secret. VERIFY against Cloudflare's testing docs.
  TURNSTILE_SECRET_KEY: '1x0000000000000000000000000000000AA',
  MAIL_TRANSPORT: 'log',
  MAIL_FROM: 'Inspire Business Group <requests@send.inspirebusinesstechnology.com>',
  // VERIFY (Valentina): Resend documents delivered@resend.dev as a test recipient.
  MAIL_TO: 'delivered@resend.dev',
}

function buildDevEnv(loaded: Env): Env {
  const env: Env = { ...DEV_DEFAULTS }
  for (const [key, value] of Object.entries(loaded)) {
    if (value !== undefined && value !== '') env[key] = value
  }
  // The dev server is never "on Vercel", even if the developer's shell exports these.
  delete env.VERCEL
  delete env.VERCEL_ENV
  return env
}

function toWebRequest(req: IncomingMessage): Request {
  const method = req.method ?? 'GET'
  const headers = new Headers()
  for (const [key, value] of Object.entries(req.headers)) {
    if (value === undefined) continue
    if (Array.isArray(value)) for (const v of value) headers.append(key, v)
    else headers.set(key, value)
  }
  const url = `http://${req.headers.host ?? 'localhost'}${(req as IncomingMessage & { originalUrl?: string }).originalUrl ?? req.url ?? '/'}`
  const hasBody = method !== 'GET' && method !== 'HEAD'
  const init: RequestInit & { duplex?: 'half' } = { method, headers }
  if (hasBody) {
    init.body = Readable.toWeb(req) as unknown as ReadableStream<Uint8Array>
    init.duplex = 'half'
  }
  return new Request(url, init)
}

async function writeWebResponse(res: ServerResponse, response: Response): Promise<void> {
  res.statusCode = response.status
  response.headers.forEach((value, key) => res.setHeader(key, value))
  res.end(Buffer.from(await response.arrayBuffer()))
}

export function serviceRequestDevApi(): Plugin {
  let env: Env = DEV_DEFAULTS
  return {
    name: 'service-request-dev-api',
    apply: 'serve',
    configResolved(config) {
      env = buildDevEnv(loadEnv(config.mode, config.root, ''))
    },
    configureServer(server) {
      server.middlewares.use('/api/service-request', (req, res) => {
        void (async () => {
          try {
            // ssrLoadModule so edits to the handler hot-reload and TypeScript is transformed by Vite.
            const mod = (await server.ssrLoadModule('/server/serviceRequest/handler.ts')) as {
              handleServiceRequest: (r: Request, d: object) => Promise<Response>
            }
            const response = await mod.handleServiceRequest(toWebRequest(req), {
              env,
              remoteAddress: req.socket.remoteAddress,
            })
            await writeWebResponse(res, response)
          } catch {
            res.statusCode = 500
            res.setHeader('Content-Type', 'application/json; charset=utf-8')
            res.setHeader('Cache-Control', 'no-store')
            res.end('{"ok":false,"error":"server"}')
          }
        })()
      })
    },
  }
}
