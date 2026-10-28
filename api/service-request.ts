// Thin Vercel adapter. All logic lives in server/serviceRequest/handler.ts.
// Nothing but this entry file may live in api/: Vercel turns every file here into a function.
//
// VERIFY (Renata, P0 spike): (a) Vercel's Node runtime accepts `export default { fetch }` (Web
// handler) for api/*.ts; fallback is a (req, res) adapter that builds a Request and pipes the
// Response, handler core unchanged.
// Relative imports in api/, server/ and shared/ end in `.js` and point at the `.ts` source (the
// standard TypeScript-ESM convention). Vercel compiles .ts to .js without rewriting specifiers, so a
// `.ts` specifier crashes the function with ERR_MODULE_NOT_FOUND. `npm run check:boundaries` enforces it.
import { handleServiceRequest } from '../server/serviceRequest/handler.js'

export default {
  fetch(request: Request): Promise<Response> {
    return handleServiceRequest(request, { env: process.env })
  },
}
