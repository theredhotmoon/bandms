import { test as setup, expect } from '@playwright/test'
import path from 'path'

const authFile = path.join(__dirname, '../.auth/admin.json')

setup('authenticate as admin', async ({ page }) => {
  const email = process.env.E2E_ADMIN_EMAIL ?? 'admin@bandms.test'
  const password = process.env.E2E_ADMIN_PASSWORD ?? 'password'

  await page.goto('/login')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Sign In' }).click()

  // Wait for successful login — toast appears
  await expect(page.locator('[data-sonner-toast]')).toContainText('Welcome back', { timeout: 10000 })

  await page.context().storageState({ path: authFile })
})
