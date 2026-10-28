// Node module-customization hook used ONLY by `npm test` (zero dependencies).
//
// Source files use the standard TypeScript-ESM convention: relative specifiers end in `.js` and
// point at the `.ts` file next to them (so the compiled output resolves in plain Node ESM, which is
// how Vercel runs the function). Node's test runner resolves specifiers literally, so this hook
// maps a relative `./x.js` imported from a `.ts` file to `./x.ts` when that file exists.
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

export async function resolve(specifier, context, nextResolve) {
  if (
    (specifier.startsWith('./') || specifier.startsWith('../')) &&
    specifier.endsWith('.js') &&
    typeof context.parentURL === 'string' &&
    context.parentURL.endsWith('.ts')
  ) {
    const candidate = new URL(specifier.slice(0, -3) + '.ts', context.parentURL)
    if (candidate.protocol === 'file:' && existsSync(fileURLToPath(candidate))) {
      return nextResolve(candidate.href, context)
    }
  }
  return nextResolve(specifier, context)
}
