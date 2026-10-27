import { test, expect, type APIRequestContext } from '@playwright/test'
import { failOnPageError } from '../../fixtures/page-errors'
import { adminHeaders, rebuildAndWait } from '../../fixtures/admin-api'
import { seedTicket, type SeededTicket } from '../../fixtures/seed'

/**
 * Where a visitor buys tickets follows what the concert sells:
 *
 * - our own ticket types only → "Buy tickets" goes to the ticket section here;
 * - an external shop only     → it goes to the shop;
 * - both                      → it asks, offering one or the other.
 *
 * The external shop used to be guessed from a link label matching
 * /ticket|buy|bilet/, and with both present the external link always won.
 * The seeded concert sells its own tickets; this spec adds an external shop
 * for the "both" case and takes it off again.
 */
const WEB = process.env.E2E_WEB_URL ?? 'http://localhost:4322'
const API = process.env.E2E_API_URL ?? 'http://localhost:8081'
const SHOP_URL = `https://tickets.example.com/e2e-choice-${Date.now()}`

test.use({ storageState: { cookies: [], origins: [] } })

let seeded: SeededTicket
let pageUrl = ''

async function setShop(request: APIRequestContext, url: string | null) {
  const res = await request.put(`${API}/api/concerts/${seeded.concert_id}`, { headers: adminHeaders(), data: { ticket_url: url } })
  if (!res.ok()) throw new Error(`PUT ticket_url failed: ${res.status()} ${await res.text()}`)
}

test.describe.serial('Public — choosing where to buy tickets', () => {
  failOnPageError()

  test.beforeAll(async ({ request }) => {
    const config = await (await request.get(`${API}/api/site-config?lang=en`)).json()
    test.skip(config?.modules?.concerts === false, 'Concerts module is off')

    seeded = seedTicket(1)
    await setShop(request, SHOP_URL)
    const concert = (await (await request.get(`${API}/api/concerts/${seeded.concert_id}`)).json()).data as { slug: string }
    pageUrl = `${WEB}/en/${config?.module_config?.concerts?.slug ?? 'concerts'}/${concert.slug}`
    await rebuildAndWait(request, Date.now(), API)
  })

  test.afterAll(async ({ request }) => {
    if (seeded) await setShop(request, null)
  })

  test('with both, "Buy tickets" offers our shop or the external one', async ({ page }) => {
    await page.goto(pageUrl)

    const dialog = page.getByTestId('ticket-choice')
    await expect(dialog).not.toBeVisible()
    await page.getByTestId('cta-tickets').click()
    await expect(dialog).toBeVisible()

    await expect(dialog.getByTestId('ticket-choice-external')).toHaveAttribute('href', SHOP_URL)
    await expect(dialog.getByTestId('ticket-choice-external')).toHaveAttribute('target', '_blank')

    // "Buy here" closes the choice and lands on our ticket list.
    await dialog.getByTestId('ticket-choice-here').click()
    await expect(dialog).not.toBeVisible()
    await expect(page).toHaveURL(/#tickets-section$/)
    await expect(page.locator('#tickets-section')).toBeVisible()
  })

  test('Esc closes the choice without choosing', async ({ page }) => {
    await page.goto(pageUrl)
    await page.getByTestId('cta-tickets').click()
    await expect(page.getByTestId('ticket-choice')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByTestId('ticket-choice')).not.toBeVisible()
  })
})
