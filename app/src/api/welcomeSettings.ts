import type { WelcomeSettings, WelcomeSettingsInput } from '@/types/welcome'
import { API_BASE, authHeaders, handleResponse } from './client'

const ENDPOINT = `${API_BASE}/api/admin/welcome-settings`

export async function fetchWelcomeSettings(token: string): Promise<WelcomeSettings> {
  const res = await fetch(ENDPOINT, { headers: authHeaders(token) })
  return (await handleResponse<{ data: WelcomeSettings }>(res)).data
}

export async function saveWelcomeSettings(token: string, input: WelcomeSettingsInput): Promise<WelcomeSettings> {
  const res = await fetch(ENDPOINT, { method: 'PUT', headers: authHeaders(token), body: JSON.stringify(input) })
  return (await handleResponse<{ data: WelcomeSettings }>(res)).data
}

/** "Show again to everyone": stamps a new campaign so every visitor's dismissal stops counting. */
export async function stampWelcomeCampaign(token: string): Promise<WelcomeSettings> {
  const res = await fetch(`${ENDPOINT}/campaign`, { method: 'POST', headers: authHeaders(token) })
  return (await handleResponse<{ data: WelcomeSettings }>(res)).data
}
