import { test as setup, expect } from '@playwright/test'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const authFile = path.join(__dirname, '../../.auth/admin.json')

setup('authenticate as admin', async ({ page }) => {
  const email = process.env.E2E_ADMIN_EMAIL ?? 'admin@bandms.test'
  const password = process.env.E2E_ADMIN_PASSWORD ?? 'password'

  // Ensure .auth directory exists
  fs.mkdirSync(path.dirname(authFile), { recursive: true })

  await page.goto('/login')
  await expect(page.getByRole('heading', { name: 'Sign In' })).toBeVisible()

  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Sign In' }).click()

  // Login redirects away from /login — wait for navigation
  await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 10000 })

  await page.context().storageState({ path: authFile })
})
