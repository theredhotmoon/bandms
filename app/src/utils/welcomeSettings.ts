import type { WelcomeBlock, WelcomeFarVisitors, WelcomeFrequency, WelcomeSettings, WelcomeSettingsInput } from '@/types/welcome'

/** Every block the welcome screen can show, in its default order. */
export const BLOCKS: readonly WelcomeBlock[] = ['concerts', 'news', 'newsletter', 'account']

/** The editable shape: a full display order, plus which of those are on. */
export interface WelcomeForm {
  order: WelcomeBlock[]
  enabled: WelcomeBlock[]
  concert_count: 1 | 2 | 3
  frequency: WelcomeFrequency
  reshow_days: number
  geo: { enabled: boolean; radius_km: number; far_visitors: WelcomeFarVisitors }
}

/** Saved (enabled) blocks first, in their saved order; the rest follow in default order. */
export function orderFrom(blocks: readonly WelcomeBlock[]): WelcomeBlock[] {
  return [...blocks, ...BLOCKS.filter(b => !blocks.includes(b))]
}

/** Swap a block with its neighbour; a no-op at either end. Never mutates. */
export function moveBlock(order: readonly WelcomeBlock[], key: WelcomeBlock, dir: -1 | 1): WelcomeBlock[] {
  const next = [...order]
  const from = next.indexOf(key)
  const to = from + dir
  if (from < 0 || to < 0 || to >= next.length) return next
  const moved = next[from]
  next[from] = next[to]
  next[to] = moved
  return next
}

/** Flip one block on/off; the result lists only enabled blocks, in display order. */
export function toggleBlock(enabled: readonly WelcomeBlock[], order: readonly WelcomeBlock[], key: WelcomeBlock): WelcomeBlock[] {
  const on = new Set(enabled)
  if (on.has(key)) on.delete(key)
  else on.add(key)
  return order.filter(b => on.has(b))
}

export function toForm(s: WelcomeSettings): WelcomeForm {
  return {
    order: orderFrom(s.blocks),
    enabled: [...s.blocks],
    concert_count: s.concert_count,
    frequency: s.frequency,
    reshow_days: s.reshow_days,
    geo: { ...s.geo },
  }
}

export function toInput(form: WelcomeForm): WelcomeSettingsInput {
  return {
    blocks: form.order.filter(b => form.enabled.includes(b)),
    concert_count: form.concert_count,
    frequency: form.frequency,
    reshow_days: form.reshow_days,
    geo: { ...form.geo },
  }
}
