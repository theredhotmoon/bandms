/**
 * The rule that stops a blank channel reaching the server as a 422 the user
 * cannot place. The message matters as much as the verdict here — it is the
 * only thing pointing at which row of which section to fix.
 */

import { describe, expect, it } from 'vitest'
import { hasUnnamedChannels, unnamedChannelMessage, unnamedChannels } from './rigValidation'
import { input } from './__fixtures__/rider'

describe('unnamedChannels', () => {
  it('finds nothing when every channel is named', () => {
    expect(unnamedChannels([input({ instrument: 'Kick' })])).toEqual([])
  })

  it('reports 1-based positions, because that is what the table shows', () => {
    const rows = [
      input({ id: 'a', instrument: 'Kick' }),
      input({ id: 'b', instrument: '' }),
      input({ id: 'c', instrument: 'Snare' }),
      input({ id: 'd', instrument: '' }),
    ]

    expect(unnamedChannels(rows)).toEqual([2, 4])
  })

  // A row of spaces passes `required` on the client and fails it on the server,
  // which is the exact split this module exists to close.
  it('counts a whitespace-only name as unnamed', () => {
    expect(unnamedChannels([input({ instrument: '   ' })])).toEqual([1])
  })

  it('treats a missing list as nothing to complain about', () => {
    expect(unnamedChannels(undefined)).toEqual([])
    expect(hasUnnamedChannels(undefined)).toBe(false)
  })
})

describe('unnamedChannelMessage', () => {
  it('returns null when every group is fine', () => {
    expect(unnamedChannelMessage([
      { label: 'Extra channels', inputs: [input({ instrument: 'Talkback' })] },
      { label: "Marek's channels", inputs: [] },
    ])).toBeNull()
  })

  it('names the row and the section when one channel is unnamed', () => {
    const message = unnamedChannelMessage([
      { label: 'Extra channels', inputs: [input({ instrument: 'Talkback' }), input({ instrument: '' })] },
    ])

    expect(message).toBe('Row 2 of Extra channels needs an instrument name before this can be saved.')
  })

  it('counts and locates them when several are unnamed', () => {
    const message = unnamedChannelMessage([
      { label: 'Extra channels', inputs: [input({ instrument: '' })] },
      { label: "Marek's channels", inputs: [input({ instrument: 'Kick' }), input({ instrument: '' })] },
    ])

    expect(message).toBe(
      '2 channels still need an instrument name: Extra channels (1); Marek\'s channels (2).',
    )
  })

  it('leaves clean groups out of the message', () => {
    const message = unnamedChannelMessage([
      { label: 'Fine', inputs: [input({ instrument: 'Kick' })] },
      { label: 'Broken', inputs: [input({ instrument: '' })] },
    ])

    expect(message).toBe('Row 1 of Broken needs an instrument name before this can be saved.')
    expect(message).not.toContain('Fine')
  })

  it('has nothing to say about a rider with no channels at all', () => {
    expect(unnamedChannelMessage([{ label: 'Extra channels', inputs: [] }])).toBeNull()
    expect(unnamedChannelMessage([])).toBeNull()
  })
})
