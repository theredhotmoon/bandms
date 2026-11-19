export type WelcomeBlock = 'concerts' | 'news' | 'newsletter' | 'account'
export type WelcomeFrequency = 'interval' | 'once'
export type WelcomeFarVisitors = 'hide_gigs' | 'no_screen'

/** What PUT /api/admin/welcome-settings accepts. */
export interface WelcomeSettingsInput {
  /** Enabled blocks, in display order. Empty is valid. */
  blocks: WelcomeBlock[]
  concert_count: 1 | 2 | 3
  frequency: WelcomeFrequency
  reshow_days: number
  geo: {
    enabled: boolean
    radius_km: number
    far_visitors: WelcomeFarVisitors
  }
}

/** GET /api/admin/welcome-settings — the input plus what the server adds. */
export interface WelcomeSettings extends WelcomeSettingsInput {
  /** Unix timestamp of the last "show again to everyone"; 0 = never pressed. */
  campaign: number
  /** False when the server has no location database. */
  geo_available: boolean
}
