import { describe, it, expect } from 'vitest'
import { BLOCKS, orderFrom, moveBlock, toggleBlock, toInput, toForm } from './welcomeSettings'
import type { WelcomeSettings } from '@/types/welcome'

function settings(over: Partial<WelcomeSettings>): WelcomeSettings {
  return {
    blocks: ['concerts', 'news'], concert_count: 2, frequency: 'interval', reshow_days: 14,
    campaign: 0, geo_available: true,
    geo: { enabled: false, radius_km: 100, far_visitors: 'hide_gigs' },
    ...over,
  }
}

describe('welcomeSettings helpers', () => {
  it('orderFrom puts the saved blocks first and appends the rest in default order', () => {
    expect(orderFrom(['newsletter', 'concerts'])).toEqual(['newsletter', 'concerts', 'news', 'account'])
    expect(orderFrom([])).toEqual([...BLOCKS])
  })

  it('moveBlock swaps with the neighbour and stops at the ends', () => {
    const order = [...BLOCKS]
    expect(moveBlock(order, 'newsletter', -1)).toEqual(['concerts', 'newsletter', 'news', 'account'])
    expect(moveBlock(order, 'concerts', -1)).toEqual(order)
    expect(moveBlock(order, 'account', 1)).toEqual(order)
    expect(moveBlock(order, 'concerts', 1)).toEqual(['news', 'concerts', 'newsletter', 'account'])
  })

  it('moveBlock does not mutate its input', () => {
    const order = [...BLOCKS]
    moveBlock(order, 'news', 1)
    expect(order).toEqual([...BLOCKS])
  })

  it('toggleBlock outputs only enabled keys, in display order', () => {
    const order = ['newsletter', 'concerts', 'news', 'account'] as const
    expect(toggleBlock(['concerts', 'newsletter'], [...order], 'news')).toEqual(['newsletter', 'concerts', 'news'])
    expect(toggleBlock(['concerts', 'newsletter'], [...order], 'concerts')).toEqual(['newsletter'])
    expect(toggleBlock(['newsletter'], [...order], 'newsletter')).toEqual([])
  })

  it('toInput keeps the display order and drops disabled blocks and server-only fields', () => {
    const form = toForm(settings({ blocks: ['newsletter', 'concerts'] }))
    expect(toInput(form).blocks).toEqual(['newsletter', 'concerts'])
    expect(toInput(form)).not.toHaveProperty('campaign')
    expect(toInput(form)).not.toHaveProperty('geo_available')
  })

  it('round-trips settings through the form', () => {
    const s = settings({ blocks: ['news'], concert_count: 3, frequency: 'once', reshow_days: 30 })
    const { campaign: _c, geo_available: _g, ...input } = s
    expect(toInput(toForm(s))).toEqual(input)
  })
})
