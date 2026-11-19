import { test as setup, expect } from '@playwright/test'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { currentCampaign } from '../../fixtures/visitor'

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

  // The consent card / welcome modal would cover the public pages specs visit
  // on this state; mark both as already answered on each public origin.
  const now = new Date().toISOString()
  const campaign = currentCampaign()
  for (const origin of [process.env.E2E_WEB_URL ?? 'http://localhost:4322', 'http://localhost:8081']) {
    try {
      const pub = await page.context().newPage()
      await pub.goto(origin, { waitUntil: 'domcontentloaded', timeout: 10_000 })
      await pub.evaluate(([n, c]) => {
        localStorage.setItem('bandms:consent', JSON.stringify({ status: 'denied', decidedAt: n }))
        localStorage.setItem('bandms:welcome', JSON.stringify({ seenAt: n, campaign: c }))
      }, [now, campaign] as const)
      await pub.close()
    } catch (e) {
      // A down web container must not fail admin-only runs.
      console.warn(`auth.setup: could not seed consent/welcome keys on ${origin}: ${(e as Error).message}`)
    }
  }

  await page.context().storageState({ path: authFile })
})
