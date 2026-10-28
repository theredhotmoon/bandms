import { test, expect } from '@playwright/test'
import { failOnPageError } from '../../fixtures/page-errors'

/**
 * BaseLayout's "Skip to content" link.
 *
 * Its text is the `skipToContent` field of the `site` copy module, so it
 * follows the page's language and the band can reword it. It used to be a
 * hardcoded English literal, which /pl/ read out to Polish screen-reader
 * users. The expectations below are the registry defaults, unless the band
 * has saved its own wording — the served site-config says which.
 */
const WEB = process.env.E2E_WEB_URL ?? 'http://localhost:4322'
const API = process.env.E2E_API_URL ?? 'http://localhost:8081'

const DEFAULTS = { en: 'Skip to content', pl: 'Przejdź do treści' } as const

test.use({ storageState: { cookies: [], origins: [] } })

test.describe('Public skip link', () => {
  failOnPageError()

  for (const lang of Object.keys(DEFAULTS) as (keyof typeof DEFAULTS)[]) {
    test(`/${lang}/ starts with a skip link in its own language`, async ({ page, request }) => {
      const res = await page.goto(`${WEB}/${lang}/`)
      test.skip(!res?.ok(), `${WEB}/${lang}/ unavailable`)

      const config = await (await request.get(`${API}/api/site-config?lang=${lang}`)).json()
      const saved: string | undefined = (config.data ?? config).module_config?.site?.settings?.skipToContent
      const expected = saved?.trim() ? saved : DEFAULTS[lang]

      // The first Tab on the page lands on it, and it is on screen once focused.
      await page.keyboard.press('Tab')
      const link = page.locator('a[href="#main-content"]')
      await expect(link).toBeFocused()
      await expect(link).toBeInViewport()
      await expect(link).toHaveText(expected)

      // And it points at something.
      await expect(page.locator('main#main-content')).toHaveCount(1)
    })
  }
})
