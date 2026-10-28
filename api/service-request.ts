// Thin Vercel adapter. All logic lives in server/serviceRequest/handler.ts.
// Nothing but this entry file may live in api/: Vercel turns every file here into a function.
//
// VERIFY (Renata, P0 spike): (a) Vercel's Node runtime accepts `export default { fetch }` (Web
// handler) for api/*.ts; fallback is a (req, res) adapter that builds a Request and pipes the
// Response, handler core unchanged. (b) Vercel's TypeScript compile follows relative `.ts`
// specifiers into server/ and shared/ under "type": "module"; fallback is `.js` specifiers.
import { handleServiceRequest } from '../server/serviceRequest/handler.ts'

export default {
  fetch(request: Request): Promise<Response> {
    return handleServiceRequest(request, { env: process.env })
  },
}
