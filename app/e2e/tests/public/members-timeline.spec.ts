import { test, expect } from '@playwright/test'
import { failOnPageError } from '../../fixtures/page-errors'

/**
 * The line-up timeline on the public About page: one row per member, a bar
 * for each, and a legend. Read-only. The maths (positions, colours, release
 * lines, one row per member) is pinned by web/src/lib/memberTimeline.test.ts.
 *
 * The page is checked against itself, never against a live API count. The
 * served page is a build from some earlier moment, and parallel specs
 * (admin/band-members, admin/member-public-page) create and delete members
 * in between. Any other spec's rebuild bakes their member in, and the API
 * drops it the moment they clean up, so "rows === API members" failed 8 vs
 * 7 whenever a cleanup beat the next rebuild. The Members section on the same
 * page comes from the same getMembers() answer in the same build, so its
 * cards and pills are what the timeline must match. The API is read only to
 * decide whether the timeline should be there at all.
 */
const WEB = process.env.E2E_WEB_URL ?? 'http://localhost:4322'
const API = process.env.E2E_API_URL ?? 'http://localhost:8081'

test.use({ storageState: { cookies: [], origins: [] } })

test.describe('Members timeline', () => {
  failOnPageError()

  test('About renders a timeline row, bar and tooltip for every member', async ({ page, request }) => {
    // site-config is the one endpoint not wrapped in `data`.
    const config = await (await request.get(`${API}/api/site-config?lang=en`)).json()
    test.skip(config.modules?.about === false, 'the About module is switched off')
    test.skip(config.module_config?.about?.visibility?.show_timeline === false, 'the timeline is switched off')

    const members = (await (await request.get(`${API}/api/band-profile/members?lang=en`)).json()).data as
      { joined_at: string | null }[]
    const profile = (await (await request.get(`${API}/api/band-profile`)).json()).data as { formation_year: number | null }
    test.skip(members.length === 0, 'no band members')
    test.skip(!profile.formation_year && members.every(m => !m.joined_at), 'nothing anchors the timeline')

    const aboutSlug = config.module_config?.about?.slug ?? 'about'
    await page.goto(`${WEB}/en/${aboutSlug}/`)

    const timeline = page.getByTestId('members-timeline')
    await expect(timeline).toBeVisible()
    const rows = timeline.getByTestId('timeline-row')
    const rowCount = await rows.count()
    expect(rowCount).toBeGreaterThan(0)
    await expect(timeline.getByTestId('timeline-bar')).toHaveCount(rowCount)

    // One row per member in the Members section: the same build's members,
    // so this holds whatever a parallel spec did to the API since. Current
    // members are cards, former ones pills (MemberGrid.vue), and the
    // timeline marks its former rows, so each half is matched on its own.
    // With the Members section switched off there is nothing to compare.
    const cards = page.locator('.mg-card')
    const pills = page.locator('.mg-pill')
    if ((await cards.count()) + (await pills.count()) > 0) {
      const formerRows = await timeline.locator('.mt-name--former').count()
      await expect(cards).toHaveCount(rowCount - formerRows)
      await expect(pills).toHaveCount(formerRows)
    }

    // Each bar's hover text names its own row's member, so a bar is not
    // anonymous colour and no row borrows another's tooltip.
    for (let i = 0; i < rowCount; i++) {
      const row = rows.nth(i)
      const name = (await row.locator('.mt-name').textContent())?.trim() ?? ''
      expect(name, `row ${i} has no name`).not.toBe('')
      const title = (await row.getByTestId('timeline-bar').getAttribute('title')) ?? ''
      expect(title.startsWith(`${name} · `), `row "${name}" has bar title "${title}"`).toBe(true)
    }
    await expect(timeline.getByTestId('timeline-legend')).not.toBeEmpty()
  })
})
