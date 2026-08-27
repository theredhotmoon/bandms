import { test, expect } from '@playwright/test'

/**
 * The press-kit modal on the public Astro site.
 *
 * Same arrangement as availability.spec.ts: absolute URLs to the `web`
 * container, skipped when it is not up, since it sits outside the Playwright
 * webServer config.
 *
 * Every assertion here is data-dependent by design — the modal lists what the
 * band actually has, so a row is proof the data exists rather than proof of a
 * hardcoded list. Tests guard rather than assume.
 */
const WEB = process.env.E2E_WEB_URL ?? 'http://localhost:4322'

test.use({ storageState: { cookies: [], origins: [] } })

async function publicSiteIsUp(request: import('@playwright/test').APIRequestContext) {
  try {
    const res = await request.get(`${WEB}/en/contact`, { timeout: 5000 })
    return res.ok()
  } catch {
    return false
  }
}

/** The card only exists when the band has something to put in the kit. */
async function openKit(page: import('@playwright/test').Page) {
  await page.goto(`${WEB}/en/contact`)

  const trigger = page.locator('button.ct-card[data-open-epk]')
  if ((await trigger.count()) === 0) return null

  await trigger.click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible({ timeout: 8000 })
  return dialog
}

test.describe('Press kit modal — public contact page', () => {
  test.beforeEach(async ({ request }) => {
    test.skip(!(await publicSiteIsUp(request)), `Astro site not reachable at ${WEB}`)
  })

  test('opens from the promoters card', async ({ page }) => {
    const dialog = await openKit(page)
    test.skip(dialog === null, 'No press-kit assets on this instance')

    await expect(dialog!).toContainText('Press kit (EPK)')
  })

  test('lists at least one asset with a format line', async ({ page }) => {
    const dialog = await openKit(page)
    test.skip(dialog === null, 'No press-kit assets on this instance')

    const rows = dialog!.locator('.ek-row')
    expect(await rows.count()).toBeGreaterThan(0)

    // Every row must carry both a title and a meta line — a row with an empty
    // meta means a field was read that the API does not actually send.
    for (let i = 0; i < (await rows.count()); i++) {
      await expect(rows.nth(i).locator('.ek-title')).not.toBeEmpty()
      await expect(rows.nth(i).locator('.ek-meta')).not.toBeEmpty()
    }
  })

  test('every asset row links somewhere real', async ({ page }) => {
    const dialog = await openKit(page)
    test.skip(dialog === null, 'No press-kit assets on this instance')

    const rows = dialog!.locator('.ek-row')
    for (let i = 0; i < (await rows.count()); i++) {
      const href = await rows.nth(i).getAttribute('href')
      expect(href, 'asset row has an href').toBeTruthy()
      expect(href).not.toBe('')
    }
  })

  // A file opens in a new tab; a page on this site navigates in place. The
  // distinction is what `isFile` exists to carry.
  test('file assets open in a new tab, pages do not', async ({ page }) => {
    const dialog = await openKit(page)
    test.skip(dialog === null, 'No press-kit assets on this instance')

    const rows = dialog!.locator('.ek-row')
    let sawFile = false

    for (let i = 0; i < (await rows.count()); i++) {
      const row = rows.nth(i)
      const href = (await row.getAttribute('href')) ?? ''
      const target = await row.getAttribute('target')

      if (href.startsWith('/storage/')) {
        expect(target, `${href} should open in a new tab`).toBe('_blank')
        expect(await row.getAttribute('rel')).toContain('noopener')
        sawFile = true
      } else {
        expect(target, `${href} should navigate in place`).toBeNull()
      }
    }

    test.skip(!sawFile, 'No file-backed assets on this instance')
  })

  test('closes on Escape', async ({ page }) => {
    const dialog = await openKit(page)
    test.skip(dialog === null, 'No press-kit assets on this instance')

    await page.keyboard.press('Escape')
    await expect(dialog!).toBeHidden({ timeout: 8000 })
  })

  test('the two modals are independent', async ({ page }) => {
    await page.goto(`${WEB}/en/contact`)

    const epkTrigger = page.locator('button.ct-card[data-open-epk]')
    test.skip((await epkTrigger.count()) === 0, 'No press-kit assets on this instance')

    // Opening the calendar must not also open the press kit: both delegate from
    // document, so a matcher that was too loose would fire both.
    await page.locator('button.ct-card[data-open-availability]').click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible({ timeout: 8000 })
    await expect(dialog).toContainText('Check our availability')
    await expect(dialog).not.toContainText('Press kit')

    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden({ timeout: 8000 })

    await epkTrigger.click()
    await expect(dialog).toBeVisible({ timeout: 8000 })
    await expect(dialog).toContainText('Press kit (EPK)')
    await expect(dialog).not.toContainText('Check our availability')
  })
})
