import { test, expect } from '@playwright/test'
import { failOnPageError } from '../../fixtures/page-errors'

/**
 * The line-up timeline on the public About page: one row per member, a bar
 * for each, and a legend. Read-only — it checks whatever the served build
 * holds against what the API says it should hold. The maths (positions,
 * colours, release lines) is pinned by web/src/lib/memberTimeline.test.ts.
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
      { first_name: string; last_name: string; joined_at: string | null }[]
    const profile = (await (await request.get(`${API}/api/band-profile`)).json()).data as { formation_year: number | null }
    test.skip(members.length === 0, 'no band members')
    test.skip(!profile.formation_year && members.every(m => !m.joined_at), 'nothing anchors the timeline')

    const aboutSlug = config.module_config?.about?.slug ?? 'about'
    await page.goto(`${WEB}/en/${aboutSlug}/`)

    const timeline = page.getByTestId('members-timeline')
    await expect(timeline).toBeVisible()
    await expect(timeline.getByTestId('timeline-row')).toHaveCount(members.length)
    await expect(timeline.getByTestId('timeline-bar')).toHaveCount(members.length)

    const first = members[0]
    // The hover text names the member — the bar is not anonymous colour.
    await expect(timeline.locator(`[data-testid="timeline-bar"][title*="${first.first_name}"]`).first()).toBeVisible()
    await expect(timeline.getByTestId('timeline-legend')).not.toBeEmpty()
  })
})
