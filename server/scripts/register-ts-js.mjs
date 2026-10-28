// `node --import ./server/scripts/register-ts-js.mjs --test ...` (see the `test` script).
import { register } from 'node:module'

register('./ts-js-resolve-hook.mjs', import.meta.url)
