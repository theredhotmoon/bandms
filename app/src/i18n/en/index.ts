import band from './band'
import common from './common'
import content from './content'
import dashboard from './dashboard'
import media from './media'
import pages from './pages'
import rider from './rider'
import setlists from './setlists'
import shell from './shell'
import shows from './shows'

/**
 * The schema source of truth. NOT `as const` — that would widen every value to
 * its own string literal type, and `pl` would then be required to repeat the
 * English text verbatim. Plain object gives "keys required, values free".
 */
export default { band, common, content, dashboard, media, pages, rider, setlists, shell, shows }
