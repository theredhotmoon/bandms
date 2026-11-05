import { test, expect, type Page } from '@playwright/test'
import { expectToast } from '../../fixtures/test-base'

/**
 * `/admin/my-profile` — a musician editing their own band-member row.
 *
 * The API sends `login_email` to admins only and ignores it from a member
 * (`BandMemberController::update`), while `BandMemberForm` marks it `required`
 * for the admin screen. On this page that left a required input empty that the
 * musician was never told the value of, so the browser blocked the submit with
 * no toast, no error and no request. The status toggle and the joined/quit dates
 * failed the other way: editable here, dropped by the server, reported as saved.
 *
 * Stubbed, because the list row below is the whole point: it is what the API
 * sends a member, with no `login_email` in it. The route is member-only and the
 * guard matches the role exactly, so the shared admin state cannot reach it.
 */

const MEMBER_ID = 9101

const MEMBER_ROW = {
  id: MEMBER_ID,
  first_name: 'Mia',
  nickname: null,
  last_name: 'Selfedit',
  role: 'Bass',
  is_current: true,
  public_page: true,
  can_login: true,
  instruments: [],
  main_instrument_id: null,
  social_links: [],
}

const MEMBER_USER = {
  id: 9201,
  first_name: 'Mia',
  last_name: 'Selfedit',
  email: 'mia@bandms.test',
  role: 'member',
  is_superadmin: false,
  band_member_id: MEMBER_ID,
}

async function openAsMember(page: Page): Promise<() => string | null> {
  let saved: string | null = null

  await page.addInitScript((user) => {
    localStorage.setItem('auth_token', 'stub-member-token')
    localStorage.setItem('auth_user', user)
  }, JSON.stringify(MEMBER_USER))

  // Registered first, so the specific routes below take precedence. A predicate,
  // because the glob `**/api/**` also matches Vite's `/src/api/*.ts` modules.
  await page.route(
    (url) => url.pathname.startsWith('/api/'),
    (route) => route.fulfill({ json: { data: [] } }),
  )
  await page.route('**/api/band-profile/members', (route) => route.fulfill({ json: { data: [MEMBER_ROW] } }))
  await page.route(`**/api/band-profile/members/${MEMBER_ID}`, (route) => {
    saved = route.request().postData() ?? ''
    return route.fulfill({ json: { data: { ...MEMBER_ROW, role: 'Rhythm Guitar' } } })
  })

  await page.goto('/admin/my-profile')
  await expect(page.locator('input[placeholder="Jane"]')).toHaveValue('Mia')
  return () => saved
}

test.describe('My Profile', () => {
  test('a member with no login email on their row can save', async ({ page }) => {
    const savedBody = await openAsMember(page)

    await page.locator('input[placeholder*="Vocalist"]').fill('Rhythm Guitar')
    await page.getByRole('button', { name: 'Update member' }).click()

    await expectToast(page, 'Profile updated')
    expect(savedBody()).toContain('Rhythm Guitar')
  })

  test('the member is not asked for a login email', async ({ page }) => {
    await openAsMember(page)

    await expect(page.locator('input[type="email"]')).toHaveCount(0)
  })

  // `update()` strips these from a member after validating them, so a control
  // here would report "Profile updated" over a change that was thrown away.
  test('the member is not offered the fields the band owns', async ({ page }) => {
    await openAsMember(page)

    await expect(page.getByText('Status', { exact: true })).toHaveCount(0)
    await expect(page.locator('input[type="date"]')).toHaveCount(0)
  })

  // The upload and `POST /instruments` are admin-only, and the old photo control
  // sent `photo: null` with the file: a save deleted the picture, kept nothing
  // and still said "Profile updated".
  test('the member is not offered the actions their role cannot perform', async ({ page }) => {
    await openAsMember(page)

    await expect(page.locator('input[type="file"]')).toHaveCount(0)
    await expect(page.getByRole('button', { name: /new instrument/i })).toHaveCount(0)
  })

  test('the save never touches the existing photo', async ({ page }) => {
    const savedBody = await openAsMember(page)

    await page.getByRole('button', { name: 'Update member' }).click()

    await expectToast(page, 'Profile updated')
    const body = JSON.parse(savedBody()!)
    expect(body).not.toHaveProperty('photo')
    expect(body).not.toHaveProperty('photo_file')
  })

  // This form is the page, so there is nowhere for Cancel to go back to.
  test('there is no Cancel button that does nothing', async ({ page }) => {
    await openAsMember(page)

    await expect(page.getByRole('button', { name: 'Cancel' })).toHaveCount(0)
  })

  // Allowed on purpose: `public_page` is the one toggle a member keeps.
  test('the member can still switch their own public page off', async ({ page }) => {
    const savedBody = await openAsMember(page)

    await page.getByTestId('member-public-page-toggle').click()
    await page.getByRole('button', { name: 'Update member' }).click()

    await expectToast(page, 'Profile updated')
    expect(JSON.parse(savedBody()!).public_page).toBe(false)
  })

  // The server ignores all of these from a member, so a blank here must not
  // read as "clear it" to anything that ever stops ignoring them.
  test('the save carries none of the fields the server ignores', async ({ page }) => {
    const savedBody = await openAsMember(page)

    await page.getByRole('button', { name: 'Update member' }).click()

    await expectToast(page, 'Profile updated')
    const body = JSON.parse(savedBody()!)
    for (const field of ['login_email', 'is_current', 'joined_at', 'quit_at']) {
      expect(body).not.toHaveProperty(field)
    }
  })
})
