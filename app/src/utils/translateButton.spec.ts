import { describe, expect, it } from 'vitest'
import { CONFIRM_MS, decideClick, replyStillApplies } from './translateButton'

describe('replyStillApplies', () => {
  const sent = { target: '', source: 'Beta' }

  it('applies when neither the target nor the source moved', () => {
    expect(replyStillApplies(sent, { target: '', source: 'Beta' })).toBe(true)
  })

  it('drops a reply when the band typed into the target meanwhile', () => {
    expect(replyStillApplies(sent, { target: 'typed', source: 'Beta' })).toBe(false)
  })

  it('drops a reply when the source text is no longer what was sent', () => {
    // The host swapped the bag under a mounted field — a reordered post block,
    // a reloaded record — so this row is not the one that asked.
    expect(replyStillApplies(sent, { target: '', source: 'Alpha' })).toBe(false)
  })
})

describe('decideClick', () => {
  it('translates an empty target on the first click', () => {
    expect(decideClick({ filled: false, armed: null, key: 'k', now: 1000 })).toEqual({ action: 'translate' })
  })

  it('arms a filled target instead of replacing it', () => {
    expect(decideClick({ filled: true, armed: null, key: 'k', now: 1000 }))
      .toEqual({ action: 'arm', until: 1000 + CONFIRM_MS })
  })

  it('replaces on the second click while armed', () => {
    const armed = { key: 'k', until: 1000 + CONFIRM_MS }
    expect(decideClick({ filled: true, armed, key: 'k', now: 2000 })).toEqual({ action: 'translate' })
  })

  it('treats a click after the confirm window as a new first click', () => {
    const armed = { key: 'k', until: 1000 + CONFIRM_MS }
    expect(decideClick({ filled: true, armed, key: 'k', now: 1000 + CONFIRM_MS + 1 }))
      .toEqual({ action: 'arm', until: 1000 + CONFIRM_MS + 1 + CONFIRM_MS })
  })

  it('arming one row does not confirm another', () => {
    const armed = { key: 'row-a', until: 1000 + CONFIRM_MS }
    expect(decideClick({ filled: true, armed, key: 'row-b', now: 2000 }))
      .toEqual({ action: 'arm', until: 2000 + CONFIRM_MS })
  })
})
