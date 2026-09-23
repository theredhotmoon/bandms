import type { MessageSchema } from '../schema'
import common from './common'
import content from './content'
import dashboard from './dashboard'
import shell from './shell'
import shows from './shows'

const pl: MessageSchema = { common, content, dashboard, shell, shows }

export default pl
