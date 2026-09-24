import type { MessageSchema } from '../schema'
import band from './band'
import common from './common'
import content from './content'
import dashboard from './dashboard'
import media from './media'
import rider from './rider'
import shell from './shell'
import shows from './shows'

const pl: MessageSchema = { band, common, content, dashboard, media, rider, shell, shows }

export default pl
