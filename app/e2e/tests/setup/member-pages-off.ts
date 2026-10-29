import fs from 'node:fs'
import { test as teardown, expect } from '@playwright/test'
import { adminHeaders, rebuildAndWait } from '../../fixtures/admin-api'
import { MEMBER_PAGES_STATE } from './member-pages-state'

/**
 * Puts About's `member_pages` switch back the way `member-pages-on.ts` found
 * it — off again only if that setup is what turned it on — and rebuilds, so
 * the served site matches the band's setting after the run, not the suite's.
 */
teardown('restore the member pages switch', async ({ request }) => {
  teardown.setTimeout(240_000)
  if (!fs.existsSync(MEMBER_PAGES_STATE)) return
  const { turnedOn } = JSON.parse(fs.readFileSync(MEMBER_PAGES_STATE, 'utf-8')) as { turnedOn: boolean }
  if (turnedOn) {
    const put = await request.put('/api/admin/modules/about', {
      headers: adminHeaders(),
      data: { visibility: { member_pages: false } },
    })
    expect(put.ok(), `PUT member_pages off → ${put.status()} ${await put.text()}`).toBe(true)
    await rebuildAndWait(request, Date.now())
  }
  fs.rmSync(MEMBER_PAGES_STATE)
})
