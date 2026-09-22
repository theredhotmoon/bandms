import type { MessageSchema } from '../schema'
import common from './common'
import dashboard from './dashboard'
import shell from './shell'

const pl: MessageSchema = { common, dashboard, shell }

export default pl
