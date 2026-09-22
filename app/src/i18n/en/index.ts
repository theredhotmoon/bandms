import common from './common'

/**
 * The schema source of truth. NOT `as const` — that would widen every value to
 * its own string literal type, and `pl` would then be required to repeat the
 * English text verbatim. Plain object gives "keys required, values free".
 */
export default { common }
