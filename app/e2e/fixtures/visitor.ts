import { execFileSync } from 'node:child_process'

/**
 * An anonymous visitor who has already answered the first-visit prompts.
 * Without this, the GA consent card and the welcome modal would cover the
 * page and block clicks in every public spec; the consent and welcome specs
 * opt out by using an empty storage state instead.
 *
 * The welcome screen reopens for a visitor whose stored campaign DIFFERS from
 * the baked one, so a constant cannot suppress it: the current campaign is
 * read from the API (served whether or not the module is on), synchronously,
 * because `test.use()` runs at file load.
 */
const ORIGINS = [process.env.E2E_WEB_URL ?? 'http://localhost:4322', 'http://localhost:8081']
const API = process.env.E2E_API_URL ?? 'http://localhost:8081'

let memo: number | undefined

/**
 * Read once per process: every spec file that seeds a visitor calls this at
 * load. `fresh` re-reads — for a spec that stamped a campaign mid-run.
 */
export function currentCampaign(opts: { fresh?: boolean } = {}): number {
  if (memo === undefined || opts.fresh) memo = readCampaign()
  return memo
}

function readCampaign(): number {
  try {
    const out = execFileSync(
      process.execPath,
      ['-e', `fetch(process.argv[1]+'/api/site-config').then(r=>r.json()).then(b=>{const c=(b.data??b).welcome?.campaign;process.stdout.write(String(Number.isFinite(c)?c:0))}).catch(()=>process.stdout.write('0'))`, API],
      { encoding: 'utf-8', timeout: 3_000 },
    )
    return Number(out) || 0
  } catch {
    return 0
  }
}

export function anonymousVisitor(opts: { fresh?: boolean } = {}) {
  const now = new Date().toISOString()
  const campaign = currentCampaign(opts)
  return {
    cookies: [],
    origins: ORIGINS.map((origin) => ({
      origin,
      localStorage: [
        { name: 'bandms:consent', value: JSON.stringify({ status: 'denied', decidedAt: now }) },
        { name: 'bandms:welcome', value: JSON.stringify({ seenAt: now, campaign }) },
      ],
    })),
  }
}
