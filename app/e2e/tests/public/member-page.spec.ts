import { test, expect, type APIRequestContext } from '@playwright/test'
import { failOnPageError } from '../../fixtures/page-errors'

/**
 * A band member's own page, /{lang}/{about}/{slug}, and the About modal's
 * link to it. Reads whichever members the API serves rather than seeding one:
 * the public site is a static build, so a seeded member would need a rebuild
 * before it existed here.
 */
const WEB = process.env.E2E_WEB_URL ?? 'http://localhost:4322'
const API = process.env.E2E_API_URL ?? 'http://localhost:8081'

test.use({ storageState: { cookies: [], origins: [] } })

interface Member { first_name: string; last_name: string; slug?: string; is_current: boolean }

async function firstMember(request: APIRequestContext) {
  const [members, config] = await Promise.all([
    request.get(`${API}/api/band-profile/members`).then((r) => r.json()),
    request.get(`${API}/api/site-config?lang=en`).then((r) => r.json()),
  ])
  // Hidden Members section → no member pages are built, by design.
  const published = config?.modules?.about !== false
    && config?.module_config?.about?.visibility?.show_members !== false
  const member = published ? (members.data as Member[]).find((m) => m.slug && m.is_current) ?? null : null
  const about = config?.module_config?.about?.slug ?? 'about'
  return { member, aboutPath: `/en/${about}` }
}

test.describe('Public — member page', () => {
  failOnPageError()

  test('renders the member with their details, the gear placeholder and a share button', async ({ page, request }) => {
    const { member, aboutPath } = await firstMember(request)
    test.skip(!member, 'No published member page on this instance (none with a slug, or About/Members hidden)')
    // No skip on a 404: a member with a slug must have a page, and a route
    // that stopped being built should fail here, not pass by skipping.
    const res = await page.goto(`${WEB}${aboutPath}/${member!.slug}`)
    expect(res?.status()).toBe(200)

    await expect(page.getByTestId('member-name')).toContainText(member!.first_name)
    await expect(page.getByTestId('member-name')).toContainText(member!.last_name)
    await expect(page.getByTestId('member-gear')).toBeVisible()
    await expect(page.getByTestId('member-share')).toBeVisible()

    // Back to the About page, which is where the crumb points.
    await expect(page.locator('.md-crumb a')).toHaveAttribute('href', aboutPath)
    // Indexable and shareable: its own canonical, and a Polish twin.
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', new RegExp(`/${member!.slug}/?$`))
    await expect(page.locator('link[rel="alternate"][hreflang="pl"]')).toHaveAttribute('href', new RegExp(`/pl/[^/]+/${member!.slug}/?$`))
  })

  test('the About page member modal links to the member page', async ({ page, request }) => {
    const { member, aboutPath } = await firstMember(request)
    test.skip(!member, 'No published member page on this instance (none with a slug, or About/Members hidden)')
    await page.goto(`${WEB}${aboutPath}`)

    const card = page.locator('.mg-card').filter({ hasText: member!.last_name }).first()
    await expect(card).toHaveCount(1)
    await card.scrollIntoViewIfNeeded()
    await page.waitForFunction(() => !document.querySelector('.mg-card')?.closest('astro-island')?.hasAttribute('ssr'))
    await card.click()

    const link = page.getByRole('dialog').getByTestId('member-page-link')
    await expect(link).toHaveAttribute('href', `${aboutPath}/${member!.slug}`)
    await link.click()
    await expect(page.getByTestId('member-name')).toContainText(member!.first_name)
  })
})
