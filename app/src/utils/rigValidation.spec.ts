/**
 * The rule that stops a blank channel reaching the server as a 422 the user
 * cannot place. The message matters as much as the verdict here — it is the
 * only thing pointing at which row of which section to fix.
 */

import { describe, expect, it } from 'vitest'
import { hasUnnamedChannels, unnamedChannelProblem, unnamedChannels } from './rigValidation'
import en from '../i18n/en'
import { input } from '@bandms/rider-core/testing'

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

describe('unnamedChannelProblem', () => {
  it('returns null when every group is fine', () => {
    expect(unnamedChannelProblem([
      { label: 'Extra channels', inputs: [input({ instrument: 'Talkback' })] },
      { label: "Marek's channels", inputs: [] },
    ])).toBeNull()
  })

  it('names the row and the section when one channel is unnamed', () => {
    expect(unnamedChannelProblem([
      { label: 'Extra channels', inputs: [input({ instrument: 'Talkback' }), input({ instrument: '' })] },
    ])).toEqual({
      key: 'band.setups.unnamedOne',
      params: { row: 2, label: 'Extra channels' },
    })
  })

  it('counts and locates them when several are unnamed', () => {
    expect(unnamedChannelProblem([
      { label: 'Extra channels', inputs: [input({ instrument: '' })] },
      { label: "Marek's channels", inputs: [input({ instrument: 'Kick' }), input({ instrument: '' })] },
    ])).toEqual({
      key: 'band.setups.unnamedMany',
      params: { total: 2, where: "Extra channels (1); Marek's channels (2)" },
    })
  })

  it('leaves clean groups out of the problem', () => {
    const problem = unnamedChannelProblem([
      { label: 'Fine', inputs: [input({ instrument: 'Kick' })] },
      { label: 'Broken', inputs: [input({ instrument: '' })] },
    ])

    expect(problem).toEqual({ key: 'band.setups.unnamedOne', params: { row: 1, label: 'Broken' } })
    expect(JSON.stringify(problem)).not.toContain('Fine')
  })

  it('has nothing to say about a rider with no channels at all', () => {
    expect(unnamedChannelProblem([{ label: 'Extra channels', inputs: [] }])).toBeNull()
    expect(unnamedChannelProblem([])).toBeNull()
  })

  it('returns keys that exist in the catalogue', () => {
    // The whole point of the key/params shape is that the caller translates.
    // A key that does not resolve would render as a dotted path in a toast,
    // and check-i18n-keys cannot see it — the caller passes a variable.
    const keys = new Set(flatKeys(en))
    expect(keys.has('band.setups.unnamedOne')).toBe(true)
    expect(keys.has('band.setups.unnamedMany')).toBe(true)
  })
})

function flatKeys(node: unknown, prefix = ''): string[] {
  if (typeof node === 'string') return [prefix]
  if (node && typeof node === 'object') {
    return Object.entries(node).flatMap(([k, v]) => flatKeys(v, prefix ? `${prefix}.${k}` : k))
  }
  return []
}
