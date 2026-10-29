import { test, expect } from '@playwright/test'

test.use({ storageState: 'e2e/.auth/admin.json' })

const KICKER = `E2E KICKER ${Date.now()}`

test.describe('Website Modules Admin', () => {
  test.describe.configure({ mode: 'serial' })

  // These tests write real copy into a shared dev database, and the public site
  // bakes whatever is there at container start — so a run that does not clean up
  // leaves "E2E KICKER 17878…" on the live contact page. Capture and restore.
  let originalKicker: string | null = null
  let originalWidth: string | null = null

  test.beforeAll(async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: 'e2e/.auth/admin.json' })
    const page = await ctx.newPage()
    await page.goto('/admin/website-modules')
    await page.waitForLoadState('networkidle')
    await page.getByRole('button', { name: 'Edit Contact settings' }).click()
    originalKicker = await page.locator('#set-kicker-en').inputValue()
    originalWidth = await page.getByTestId('content-width').inputValue()
    await ctx.close()
  })

  test.afterAll(async ({ browser }) => {
    if (originalKicker === null) return
    const ctx = await browser.newContext({ storageState: 'e2e/.auth/admin.json' })
    const page = await ctx.newPage()
    await page.goto('/admin/website-modules')
    await page.waitForLoadState('networkidle')
    await page.getByRole('button', { name: 'Edit Contact settings' }).click()
    await page.locator('#set-kicker-en').fill(originalKicker)
    if (originalWidth !== null) await page.getByTestId('content-width').selectOption(originalWidth)
    await page.getByRole('button', { name: /^Save$/ }).click()
    await page.locator('#set-kicker-en').waitFor({ state: 'hidden', timeout: 8000 })
    await ctx.close()
  })

  test('page loads and lists modules', async ({ page }) => {
    await page.goto('/admin/website-modules')
    await page.waitForLoadState('networkidle')

    await expect(page.getByRole('heading', { name: 'Website Modules' })).toBeVisible()
    // The row leads with the band's custom name in their first content
    // language and shows the display name after it in parentheses — so on a
    // Polish-first band this reads "Kontakt (Contact)". Match either form.
    await expect(page.getByText(/^Contact$|^\(Contact\)$/).first()).toBeVisible({ timeout: 8000 })
  })

  test('page copy fields appear only for modules that define them', async ({ page }) => {
    await page.goto('/admin/website-modules')
    await page.waitForLoadState('networkidle')

    // The edit button carries a unique aria-label per module, which is a far
    // steadier hook than filtering rows by text.
    await page.getByRole('button', { name: 'Edit Contact settings' }).click()

    await expect(page.getByText('Page copy')).toBeVisible({ timeout: 8000 })
    await expect(page.locator('#set-kicker-en')).toBeVisible()
    await expect(page.locator('#set-lead-pl')).toBeVisible()
  })

  test('saving a kicker persists it and it survives a reload', async ({ page }) => {
    await page.goto('/admin/website-modules')
    await page.waitForLoadState('networkidle')

    await page.getByRole('button', { name: 'Edit Contact settings' }).click()

    const kicker = page.locator('#set-kicker-en')
    await expect(kicker).toBeVisible({ timeout: 8000 })
    await kicker.fill(KICKER)

    await page.getByRole('button', { name: /^Save$/ }).click()

    // The panel closes on success; a reload proves it round-tripped rather than
    // just clearing the form.
    await expect(page.locator('#set-kicker-en')).not.toBeVisible({ timeout: 8000 })

    await page.reload()
    await page.waitForLoadState('networkidle')

    await page.getByRole('button', { name: 'Edit Contact settings' }).click()
    await expect(page.locator('#set-kicker-en')).toHaveValue(KICKER, { timeout: 8000 })
  })

  // The API merges per locale, so editing English must not blank Polish. This is
  // the same trap the URL slug fields set, and the reason both send explicit
  // nulls rather than omitting a locale.
  test('editing one locale leaves the other intact', async ({ page }) => {
    await page.goto('/admin/website-modules')
    await page.waitForLoadState('networkidle')

    await page.getByRole('button', { name: 'Edit Contact settings' }).click()

    const polish = page.locator('#set-kicker-pl')
    await expect(polish).toBeVisible({ timeout: 8000 })

    const before = await polish.inputValue()
    test.skip(before === '', 'No Polish kicker stored to protect')

    await page.locator('#set-kicker-en').fill(`${KICKER}-again`)
    await page.getByRole('button', { name: /^Save$/ }).click()
    await expect(page.locator('#set-kicker-en')).not.toBeVisible({ timeout: 8000 })

    await page.reload()
    await page.waitForLoadState('networkidle')

    await page.getByRole('button', { name: 'Edit Contact settings' }).click()
    await expect(page.locator('#set-kicker-pl')).toHaveValue(before, { timeout: 8000 })
  })

  // ── Grouped page copy ─────────────────────────────────────────────────────
  //
  // Every string on a public page is a field here, grouped by the page's own
  // sections. The registry (@bandms/site-copy) supplies both the grouping and
  // the placeholder, which is the text the page prints when the box is empty.
  test('groups page copy by page section, with the header group open first', async ({ page }) => {
    await page.goto('/admin/website-modules')
    await page.waitForLoadState('networkidle')
    await page.getByRole('button', { name: 'Edit Concerts settings' }).click()

    const copy = page.getByTestId('page-copy')
    await expect(copy).toBeVisible({ timeout: 8000 })

    const header = copy.locator('details[data-copy-group="Page header"]')
    const upcoming = copy.locator('details[data-copy-group="Upcoming shows"]')
    const archive = copy.locator('details[data-copy-group="Played shows"]')
    await expect(header).toHaveAttribute('open', '')
    await expect(upcoming).not.toHaveAttribute('open', '')
    await expect(archive).toBeVisible()

    // Closed group: its inputs exist but are hidden until the summary is opened.
    const heading = page.locator('#set-upcomingTitle-en')
    await expect(heading).toBeHidden()
    await upcoming.locator('summary').click()
    await expect(heading).toBeVisible()

    // The placeholder is the live default, per locale.
    await expect(heading).toHaveAttribute('placeholder', 'Upcoming shows')
    await expect(page.locator('#set-upcomingTitle-pl')).toHaveAttribute('placeholder', 'Nadchodzące koncerty')
    await expect(page.locator('#set-mapTitle-en')).toHaveAttribute('placeholder', 'Where we play')
  })

  test('the About page exposes its member, stats and press headings as copy', async ({ page }) => {
    await page.goto('/admin/website-modules')
    await page.waitForLoadState('networkidle')
    await page.getByRole('button', { name: 'Edit About settings' }).click()

    const copy = page.getByTestId('page-copy')
    await expect(copy).toBeVisible({ timeout: 8000 })
    for (const group of ['Band in numbers', 'Band members', 'Press & booking']) {
      await expect(copy.locator(`details[data-copy-group="${group}"]`)).toBeVisible()
    }
    await copy.locator('details[data-copy-group="Band members"] summary').click()
    await expect(page.locator('#set-members-en')).toHaveAttribute('placeholder', 'The line-up')
    await expect(page.locator('#set-membersSub-pl')).toHaveAttribute('placeholder', 'Kliknij muzyka, by poznać jego historię.')
  })

  // home, privacy and site are rows that exist for their copy alone. They get
  // the copy form, and none of the inputs that would move a page.
  test('copy-only rows show page copy but no URL slug', async ({ page }) => {
    await page.goto('/admin/website-modules')
    await page.waitForLoadState('networkidle')

    for (const [name, group] of [['Homepage', 'Hero'], ['Site-wide', '404 page'], ['Privacy & cookies', 'Cookie banner']] as const) {
      await page.getByRole('button', { name: `Edit ${name} settings` }).click()
      const copy = page.getByTestId('page-copy')
      await expect(copy).toBeVisible({ timeout: 8000 })
      await expect(copy.locator(`details[data-copy-group="${group}"]`)).toBeVisible()
      await expect(page.getByText('URL slug', { exact: true })).toHaveCount(0)
      await page.getByRole('button', { name: 'Cancel' }).click()
    }
  })

  test('is closed to non-admins', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } })
    const page = await ctx.newPage()

    await page.goto('/admin/website-modules')
    // Bounced to the panel root, which renders the sign-in form — there is no
    // /login route to land on any more.
    await expect(page).toHaveURL(/\/admin\/?$/, { timeout: 10_000 })
    await expect(page.getByRole('heading', { name: 'Sign In' })).toBeVisible()

    await ctx.close()
  })

  // ── Section visibility (About) ────────────────────────────────────────────
  //
  // Wiring only, no save — e2e/tests/public/about-section-visibility.spec.ts
  // writes to this same module's `visibility` bag via direct API PUT (to seed
  // content and prove the public page respects the flag, requiring a real
  // rebuild). That file runs in its own worker; a save here would resend
  // whatever this page's draft last loaded and can stomp its seeded value
  // mid-run, the same class of cross-file race the about_bio_variant feature
  // hit — see e2e/tests/public/about-bio-variant.spec.ts's own note.
  // Persistence through a real save is already covered by the Pest test in
  // WebsiteModuleTest.php ("saves a visibility toggle") and by that public
  // spec's own PUT-then-read round trip.
  //
  // The checkbox must mirror the *stored* flag, not a default: on a database
  // synced from production the band may have hidden a section, and this spec
  // failed there for asserting "checked". Absent-means-shown is the API's
  // rule, pinned in WebsiteModuleTest.php; here it only decides the reading.
  //
  // The flag is read from the LAST modules response before the form opens,
  // because that is the data the form is built from. The first one is not:
  // the list refetches on a content-language switch, and the public spec can
  // PUT this flag in another worker in between.
  test('offers a section-visibility checkbox per configured toggle, reflecting the stored flag', async ({ page }) => {
    type ModulesBody = { data: { slug: string, visibility?: Record<string, boolean> }[] }
    // A holder, not a `let`: TS narrows a let assigned only in a callback to null.
    const seen: { latest: Promise<ModulesBody> | null } = { latest: null }
    page.on('response', r => {
      if (r.url().endsWith('/api/admin/modules') && r.request().method() === 'GET' && r.ok()) {
        seen.latest = r.json() as Promise<ModulesBody>
      }
    })

    await page.goto('/admin/website-modules')
    await page.waitForLoadState('networkidle')
    if (!seen.latest) throw new Error('the page never loaded /api/admin/modules')
    const { data } = await seen.latest
    const statsShown = data.find(m => m.slug === 'about')?.visibility?.show_stats !== false
    await page.getByRole('button', { name: 'Edit About settings' }).click()

    await expect(page.getByText('Section visibility')).toBeVisible({ timeout: 8000 })
    // Scoped to the checkbox labels: the same two names are also page-copy
    // group headings further up the form.
    await expect(page.locator('label[for="visibility-show_stats"]')).toContainText('Band in numbers')
    await expect(page.locator('label[for="visibility-show_members"]')).toContainText('Band members')
    await expect(page.locator('label[for="visibility-member_pages"]')).toContainText('Member pages')

    const statsCheckbox = page.locator('#visibility-show_stats')
    await expect(statsCheckbox).toBeChecked({ checked: statsShown })
    // Both directions, ending where it started — nothing is saved.
    await statsCheckbox.setChecked(!statsShown)
    await expect(statsCheckbox).toBeChecked({ checked: !statsShown })
    await statsCheckbox.setChecked(statsShown)
    await expect(statsCheckbox).toBeChecked({ checked: statsShown })
  })

  // The public half — that the page actually renders at this width — is
  // tests/public/content-width.spec.ts.
  test('content width saves and survives a reload', async ({ page }) => {
    await page.goto('/admin/website-modules')
    await page.waitForLoadState('networkidle')
    await page.getByRole('button', { name: 'Edit Contact settings' }).click()

    const select = page.getByTestId('content-width')
    await expect(select).toBeVisible({ timeout: 8000 })
    const flipped = (await select.inputValue()) === 'limited' ? 'full' : 'limited'
    await select.selectOption(flipped)

    const saved = page.waitForResponse(r => r.url().includes('/api/admin/modules/contact') && r.request().method() === 'PUT')
    await page.getByRole('button', { name: /^Save$/ }).click()
    expect((await (await saved).json()).data.content_width).toBe(flipped)
    await expect(select).not.toBeVisible({ timeout: 8000 })

    await page.reload()
    await page.waitForLoadState('networkidle')
    await page.getByRole('button', { name: 'Edit Contact settings' }).click()
    await expect(page.getByTestId('content-width')).toHaveValue(flipped, { timeout: 8000 })
  })

  test('content width is not offered on chrome rows', async ({ page }) => {
    await page.goto('/admin/website-modules')
    await page.waitForLoadState('networkidle')
    await page.getByRole('button', { name: 'Edit Footer settings' }).click()
    await expect(page.getByText('Page copy')).toBeVisible({ timeout: 8000 })
    await expect(page.getByTestId('content-width')).toHaveCount(0)
  })
})
