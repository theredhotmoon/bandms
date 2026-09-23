import type { MessageSchema } from '../schema'
import common from './common'
import dashboard from './dashboard'
import shell from './shell'
import shows from './shows'

const pl: MessageSchema = { common, dashboard, shell, shows }

export default pl
