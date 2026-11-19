import { execFileSync } from 'child_process'

/**
 * Ticket fixtures for the E2E suite.
 *
 * Tickets are minted only by the signed Stripe webhook, and Stripe is not
 * configured locally — so there is no way to produce an issued ticket through
 * the running app. `php artisan e2e:seed-ticket` builds one directly and prints
 * its identifiers as JSON; this shells out to it in the backend container.
 *
 * The Docker coupling is not new: scripts/test-all.sh already refuses to run
 * E2E unless bandms_backend is up.
 */

export interface SeededTicket {
  ticket_uuid: string
  ticket_uuids: string[]
  concert_id: number
  ticket_type_id: number
  ticket_type: string
  venue_name: string
  fan_email: string
  fan_name: string
  order_uuid: string
}

const CONTAINER = process.env.E2E_BACKEND_CONTAINER ?? 'bandms_backend'

/**
 * Mint `count` issued tickets on a fresh concert and return their identifiers.
 *
 * Throws with the container's own output on failure — a fixture that fails
 * silently produces specs that fail somewhere far less obvious.
 */
export function seedTicket(count = 1): SeededTicket {
  let raw: string
  try {
    raw = execFileSync(
      'docker',
      ['exec', CONTAINER, 'php', 'artisan', 'e2e:seed-ticket', `--tickets=${count}`, '--force'],
      { encoding: 'utf-8', timeout: 60_000 },
    )
  } catch (e) {
    const err = e as { stdout?: string; stderr?: string; message: string }
    throw new Error(
      `seedTicket failed. Is the ${CONTAINER} container running?\n` +
        `${err.stderr ?? ''}${err.stdout ?? ''}${err.message}`,
    )
  }

  // The command prints one line of JSON; artisan may add blank lines around it.
  const line = raw
    .split('\n')
    .map(l => l.trim())
    .filter(Boolean)
    .find(l => l.startsWith('{'))

  if (!line) {
    throw new Error(`seedTicket: no JSON in command output:\n${raw}`)
  }

  return JSON.parse(line) as SeededTicket
}

/**
 * Delete every fixture `seedTicket` has created.
 *
 * Called from the teardown project once the suite finishes. Failure is reported
 * but not thrown: leftover fixtures are a housekeeping problem, and failing the
 * run over them would turn a tidy-up into a red build that says nothing about
 * the code under test.
 */
export function purgeSeededFixtures(): void {
  try {
    const out = execFileSync(
      'docker',
      ['exec', CONTAINER, 'php', 'artisan', 'e2e:purge', '--force'],
      { encoding: 'utf-8', timeout: 60_000 },
    )
    console.log(out.trim())
  } catch (e) {
    const err = e as { stdout?: string; stderr?: string; message: string }
    console.warn(
      `[teardown] e2e:purge failed — fixtures were left in the database.
` +
        `${err.stderr ?? ''}${err.stdout ?? ''}${err.message}`,
    )
  }
}

export interface SeededFanSession {
  fan_id: number
  email: string
  name: string
  /** A live `fan_session` token — what the account page stores as `fan_token`. */
  token: string
}

/**
 * A signed-in fan for the comment specs. The backend has APP_DEBUG off, so the
 * emailed sign-in link cannot be followed from a test; `e2e:seed-fan-session`
 * creates the fan and the session directly. The fan is `e2e-…`, so the
 * teardown purge removes it, and its comments with it.
 */
export function seedFanSession(displayName?: string): SeededFanSession {
  const args = ['exec', CONTAINER, 'php', 'artisan', 'e2e:seed-fan-session', '--force']
  if (displayName) args.push(`--display-name=${displayName}`)

  let raw: string
  try {
    raw = execFileSync('docker', args, { encoding: 'utf-8', timeout: 60_000 })
  } catch (e) {
    const err = e as { stdout?: string; stderr?: string; message: string }
    throw new Error(
      `seedFanSession failed. Is the ${CONTAINER} container running?\n` +
        `${err.stderr ?? ''}${err.stdout ?? ''}${err.message}`,
    )
  }

  const line = raw.split('\n').map(l => l.trim()).filter(Boolean).find(l => l.startsWith('{'))
  if (!line) throw new Error(`seedFanSession: no JSON in command output:\n${raw}`)

  return JSON.parse(line) as SeededFanSession
}
