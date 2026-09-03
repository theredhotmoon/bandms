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

  await page.goto('/admin')
  await expect(page.getByRole('heading', { name: 'Sign In' })).toBeVisible()

  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Sign In' }).click()

  // Signing in does not navigate any more — the panel root swaps the form for
  // the dashboard in place. Waiting on the URL here would pass INSTANTLY (it has
  // never contained /login) and save a signed-out storageState, which fails every
  // authenticated spec in the suite with a misleading error. Wait for the
  // dashboard's own heading instead.
  await expect(page.locator('h1')).toContainText('Welcome back', { timeout: 10000 })

  await page.context().storageState({ path: authFile })
})
