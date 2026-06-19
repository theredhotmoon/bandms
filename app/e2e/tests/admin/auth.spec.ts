import { test, expect, type Page } from '@playwright/test'

// Auth tests do not use the shared storageState — they exercise the login flow
// directly. Each test starts with a clean, unauthenticated browser context.
test.use({ storageState: { cookies: [], origins: [] } })

const EMAIL    = process.env.E2E_ADMIN_EMAIL    ?? 'admin@bandms.test'
const PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? 'password'

// ─── helpers ──────────────────────────────────────────────────────────────────

async function fillAndSubmit(page: Page, email: string, password: string) {
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Sign In' }).click()
}

// ─── redirect guards (no auth required for these assertions) ──────────────────

test.describe('Unauthenticated redirect guard', () => {
  test('visiting /admin redirects to /login', async ({ page }) => {
    await page.goto('/admin')
    await expect(page).toHaveURL(/\/login/)
  })

  test('visiting /admin/concerts redirects to /login', async ({ page }) => {
    await page.goto('/admin/concerts')
    await expect(page).toHaveURL(/\/login/)
  })

  test('visiting /admin/users redirects to /login', async ({ page }) => {
    await page.goto('/admin/users')
    await expect(page).toHaveURL(/\/login/)
  })
})

// ─── login page rendering ─────────────────────────────────────────────────────

test.describe('Login page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login')
    await expect(page.getByRole('heading', { name: 'Sign In' })).toBeVisible()
  })

  test('renders email and password fields and a submit button', async ({ page }) => {
    await expect(page.locator('input[type="email"]')).toBeVisible()
    await expect(page.locator('input[type="password"]')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Sign In' })).toBeVisible()
  })

  test('shows "Signing in…" on the button while the request is in flight', async ({ page }) => {
    // Slow the login API response so the loading state is observable
    await page.route('**/api/auth/login', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 1500))
      await route.continue()
    })

    await fillAndSubmit(page, EMAIL, PASSWORD)
    await expect(page.getByRole('button', { name: 'Signing in…' })).toBeVisible()
  })

  test('submit button is disabled while signing in', async ({ page }) => {
    await page.route('**/api/auth/login', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 1500))
      await route.continue()
    })

    await fillAndSubmit(page, EMAIL, PASSWORD)
    await expect(page.getByRole('button', { name: 'Signing in…' })).toBeDisabled()
  })
})

// ─── successful login ─────────────────────────────────────────────────────────

test.describe('Successful login', () => {
  test('shows "Welcome back" toast after valid credentials', async ({ page }) => {
    await page.goto('/login')
    await fillAndSubmit(page, EMAIL, PASSWORD)

    await expect(
      page.locator('[data-sonner-toast]').filter({ hasText: 'Welcome back' }),
    ).toBeVisible({ timeout: 10_000 })
  })

  test('stores auth_token in localStorage after login', async ({ page }) => {
    await page.goto('/login')
    await fillAndSubmit(page, EMAIL, PASSWORD)

    await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 20_000 })

    const token = await page.evaluate(() => localStorage.getItem('auth_token'))
    expect(token).not.toBeNull()
    expect(token!.length).toBeGreaterThan(0)
  })

  test('stores auth_user JSON in localStorage after login', async ({ page }) => {
    await page.goto('/login')
    await fillAndSubmit(page, EMAIL, PASSWORD)

    await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 20_000 })

    const raw = await page.evaluate(() => localStorage.getItem('auth_user'))
    expect(raw).not.toBeNull()
    const user = JSON.parse(raw!)
    expect(user).toHaveProperty('role')
  })

  test('redirects away from /login after successful login', async ({ page }) => {
    await page.goto('/login')
    await fillAndSubmit(page, EMAIL, PASSWORD)

    await expect(page).not.toHaveURL(/\/login/, { timeout: 10_000 })
  })

  test('navigating to /admin after login shows the dashboard', async ({ page }) => {
    await page.goto('/login')
    await fillAndSubmit(page, EMAIL, PASSWORD)

    await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 20_000 })

    await page.goto('/admin')
    await page.waitForLoadState('networkidle')
    await expect(page.locator('h1')).toContainText('Welcome back')
  })
})

// ─── failed login ─────────────────────────────────────────────────────────────

test.describe('Failed login', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login')
  })

  test('wrong password shows a credentials error message', async ({ page }) => {
    await fillAndSubmit(page, EMAIL, 'wrong-password-xyz')

    // The API returns a 422/401 with a message such as
    // "The provided credentials are incorrect."
    await expect(
      page.locator('p').filter({ hasText: /credentials|incorrect|invalid/i }),
    ).toBeVisible({ timeout: 8_000 })
  })

  test('wrong password does not store a token in localStorage', async ({ page }) => {
    await fillAndSubmit(page, EMAIL, 'wrong-password-xyz')

    await page.waitForTimeout(2_000)
    const token = await page.evaluate(() => localStorage.getItem('auth_token'))
    expect(token).toBeNull()
  })

  test('wrong password keeps the user on /login', async ({ page }) => {
    await fillAndSubmit(page, EMAIL, 'wrong-password-xyz')

    await page.waitForTimeout(2_000)
    await expect(page).toHaveURL(/\/login/)
  })

  test('missing email shows browser/field validation', async ({ page }) => {
    // Leave email blank; fill password only and attempt submit
    await page.locator('input[type="password"]').fill(PASSWORD)
    await page.getByRole('button', { name: 'Sign In' }).click()

    // The input[required] constraint prevents submission — email field gets
    // browser validation state. Playwright can check validity via JS.
    const valid = await page.locator('input[type="email"]').evaluate(
      (el) => (el as HTMLInputElement).validity.valid,
    )
    expect(valid).toBe(false)
  })

  test('missing password shows browser/field validation', async ({ page }) => {
    await page.locator('input[type="email"]').fill(EMAIL)
    await page.getByRole('button', { name: 'Sign In' }).click()

    const valid = await page.locator('input[type="password"]').evaluate(
      (el) => (el as HTMLInputElement).validity.valid,
    )
    expect(valid).toBe(false)
  })
})

// ─── role guard ───────────────────────────────────────────────────────────────

test.describe('Role guard', () => {
  test('non-admin authenticated user visiting /admin/users is redirected to /admin', async ({
    page,
  }) => {
    // Set localStorage with a member role token so the auth guard passes
    // but the role guard blocks /admin/users (admin-only).
    await page.goto('/login')
    await page.evaluate(([token, user]) => {
      localStorage.setItem('auth_token', token)
      localStorage.setItem('auth_user', user)
    }, [
      'fake-member-token',
      JSON.stringify({ role: 'member', first_name: 'Test', email: 'member@bandms.test' }),
    ])

    await page.goto('/admin/users')
    // The role guard redirects to { name: 'admin' } → /admin
    await expect(page).toHaveURL(/\/admin$/, { timeout: 5_000 })
  })
})

// ─── logout ───────────────────────────────────────────────────────────────────

// Logout tests use the shared admin storageState but mock the backend logout endpoint
// so the shared token (used by all concurrent tests) is NOT revoked on the server.
// Without this mock, the logout call would revoke the shared Passport token, causing
// all other parallel tests to receive 401 responses and redirect to /login.
test.describe('Logout', () => {
  test.use({ storageState: 'e2e/.auth/admin.json' })

  test('clicking "Sign out" in the sidebar clears localStorage and redirects', async ({
    page,
  }) => {
    // Mock the logout endpoint — verify frontend behaviour without revoking the shared token
    await page.route('**/api/auth/logout', async (route) => {
      await route.fulfill({ status: 200, body: '{}', contentType: 'application/json' })
    })

    await page.goto('/admin')
    await page.waitForLoadState('networkidle')

    // Click the "Sign out" button in the sidebar footer
    await page.getByRole('button', { name: /sign out/i }).click()

    // Should redirect away from /admin (to /login)
    await expect(page).toHaveURL(/\/login/, { timeout: 8_000 })

    // localStorage auth keys must be cleared
    const token = await page.evaluate(() => localStorage.getItem('auth_token'))
    const user  = await page.evaluate(() => localStorage.getItem('auth_user'))
    expect(token).toBeNull()
    expect(user).toBeNull()
  })

  test('after logout, navigating to /admin redirects back to /login', async ({ page }) => {
    await page.route('**/api/auth/logout', async (route) => {
      await route.fulfill({ status: 200, body: '{}', contentType: 'application/json' })
    })

    await page.goto('/admin')
    await page.waitForLoadState('networkidle')

    // Logout
    await page.getByRole('button', { name: /sign out/i }).click()
    await expect(page).toHaveURL(/\/login/, { timeout: 8_000 })

    // Try to revisit admin
    await page.goto('/admin')
    await expect(page).toHaveURL(/\/login/)
  })
})
