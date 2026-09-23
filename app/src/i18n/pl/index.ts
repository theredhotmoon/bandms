import type { MessageSchema } from '../schema'
import band from './band'
import common from './common'
import content from './content'
import dashboard from './dashboard'
import shell from './shell'
import shows from './shows'

const pl: MessageSchema = { band, common, content, dashboard, shell, shows }

export default pl
