import type { MessageSchema } from '../schema'
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

const pl: MessageSchema = { band, common, content, dashboard, media, pages, rider, setlists, shell, shows }

export default pl
