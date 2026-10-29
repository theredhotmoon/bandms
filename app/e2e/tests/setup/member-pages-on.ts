import fs from 'node:fs'
import { test as setup, expect } from '@playwright/test'
import { adminHeaders, rebuildAndWait } from '../../fixtures/admin-api'
import { MEMBER_PAGES_STATE } from './member-pages-state'

/**
 * Builds member pages for the specs that test them.
 *
 * Member pages exist only while About's `member_pages` switch is on (#216), and
 * a database pulled from production may well have it off — the band's choice.
 * Left that way, every member-page spec seeds a member and waits for a page
 * that is never built. So this turns the switch on for the run and records
 * whether it did; `member-pages-off.ts`, this project's teardown, puts it back.
 *
 * Not named `*.setup.ts`: the `setup` project matches that, and this must run
 * after it (it needs the admin token) as its own project.
 */
setup('turn member pages on for the run', async ({ request }) => {
  setup.setTimeout(240_000)
  const res = await request.get('/api/admin/modules', { headers: adminHeaders() })
  expect(res.ok(), `GET /api/admin/modules → ${res.status()}`).toBe(true)
  const about = ((await res.json()).data as { slug: string; visibility?: Record<string, boolean> }[])
    .find((m) => m.slug === 'about')
  const wasOff = about?.visibility?.member_pages === false

  // Written before the switch flips, so a run killed mid-setup still restores.
  fs.writeFileSync(MEMBER_PAGES_STATE, JSON.stringify({ turnedOn: wasOff }))
  if (!wasOff) return

  // The visibility bag merges server-side, so only this key changes.
  const put = await request.put('/api/admin/modules/about', {
    headers: adminHeaders(),
    data: { visibility: { member_pages: true } },
  })
  expect(put.ok(), `PUT member_pages on → ${put.status()} ${await put.text()}`).toBe(true)
  await rebuildAndWait(request, Date.now())
})
