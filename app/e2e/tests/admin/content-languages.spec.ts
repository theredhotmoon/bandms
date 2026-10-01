import { test, expect, type Page } from '@playwright/test'

test.use({ storageState: 'e2e/.auth/admin.json' })

/**
 * The content-language order is ONE row shared by every form in the admin, and
 * it decides which language's title is `required`. Writing it for real would
 * make every parallel spec that fills only the English title fail HTML
 * validation for as long as this one ran. So the order is served by
 * `page.route` instead: this spec checks the wiring (cards, forms, tabs follow
 * the order), and ContentLocaleTest.php checks that the API stores it.
 */
const ENDPOINT = /\/api\/admin\/content-locales$/

async function serveOrder(page: Page, order: string[]): Promise<{ puts: string[][] }> {
  const puts: string[][] = []
  let current = order
  await page.route(ENDPOINT, async (route) => {
    if (route.request().method() === 'PUT') {
      current = (route.request().postDataJSON() as { order: string[] }).order
      puts.push(current)
    }
    await route.fulfill({ json: { data: { order: current } } })
  })
  return { puts }
}

test.describe('Content languages', () => {
  test('the website-modules card reorders and saves the full order', async ({ page }) => {
    const { puts } = await serveOrder(page, ['en', 'pl'])
    await page.goto('/admin/website-modules')

    const card = page.getByTestId('content-languages')
    const rows = card.locator('li[data-locale]')
    await expect(rows).toHaveCount(2)
    await expect(rows.first()).toHaveAttribute('data-locale', 'en')

    await card.getByRole('button', { name: 'Move Polski up' }).click()

    await expect(rows.first()).toHaveAttribute('data-locale', 'pl')
    await expect(rows.first()).toContainText('Written first')
    expect(puts).toEqual([['pl', 'en']])
  })

  test('a Polish-first band gets the Polish title first, and required', async ({ page }) => {
    await serveOrder(page, ['pl', 'en'])
    await page.goto('/admin/posts')
    await page.getByRole('button', { name: '+ Add post' }).click()

    const titleRows = page.locator('form .trans-group').first().locator('[data-locale]')
    await expect(titleRows.first()).toHaveAttribute('data-locale', 'pl')
    await expect(titleRows.first()).toContainText('PL')

    // The `required` follows the order, not the language: a Polish-only post
    // must be submittable, an English-only one must not.
    await expect(page.getByPlaceholder('Tytuł posta')).toHaveAttribute('required', '')
    await expect(page.getByPlaceholder('Post title')).not.toHaveAttribute('required', '')

    // Slugs follow the same order even though they are still per-column.
    const slugRows = page.locator('.slug-row[data-locale]')
    await expect(slugRows.first()).toHaveAttribute('data-locale', 'pl')
  })

  test('the default order keeps today\'s English-first forms', async ({ page }) => {
    await serveOrder(page, ['en', 'pl'])
    await page.goto('/admin/posts')
    await page.getByRole('button', { name: '+ Add post' }).click()

    await expect(page.getByPlaceholder('Post title')).toHaveAttribute('required', '')
    await expect(page.getByPlaceholder('Tytuł posta')).not.toHaveAttribute('required', '')
  })

  test('the band bio opens on the band\'s writing language', async ({ page }) => {
    await serveOrder(page, ['pl', 'en'])
    await page.goto('/admin/band-profile')

    const tabs = page.locator('.bio-lang-switcher [data-locale]')
    await expect(tabs.first()).toHaveAttribute('data-locale', 'pl')
    await expect(tabs.first()).toHaveClass(/active/)
  })
})
