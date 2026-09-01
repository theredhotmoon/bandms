/**
 * The diff is what tells a venue "we changed two channels since the sheet you
 * have". Getting it wrong is worse than not having it: a missed change reads as
 * a promise that nothing moved.
 */

import { describe, expect, it } from 'vitest'
import { diffRiders, resolveSnapshot } from './riderDiff'
import {
  backline,
  input,
  member,
  monitor,
  placement,
  rider,
  setup,
  snapshot,
  wireless,
} from '@bandms/rider-core/testing'

/** Two versions of a rider whose single musician plays the given channels. */
function versions(before: ReturnType<typeof setup>, after: ReturnType<typeof setup>) {
  const draft = rider({ placements: [placement({ id: 'p1', setup_id: 1, band_member_id: 1 })] })

  return diffRiders(
    snapshot(1, draft, [before]),
    snapshot(2, draft, [after]),
  )
}

describe('diffRiders', () => {
  it('reports nothing when the rendered rider is unchanged', () => {
    const rig = setup(1, { inputs: [input({ id: 'a1' })] })
    const diff = versions(rig, setup(1, { inputs: [input({ id: 'a1' })] }))

    expect(diff.identical).toBe(true)
    expect(diff.sections).toEqual([])
    expect(diff.summary).toBe('')
  })

  it('carries the version numbers being compared', () => {
    const diff = versions(setup(1), setup(1))

    expect(diff.from).toBe(1)
    expect(diff.to).toBe(2)
  })

  it('reports an added channel', () => {
    const diff = versions(
      setup(1, { inputs: [input({ id: 'a1' })] }),
      setup(1, { inputs: [input({ id: 'a1' }), input({ id: 'a2', instrument: 'Snare' })] }),
    )

    const channels = diff.sections.find((s) => s.title === 'Channels')!
    expect(channels.entries).toHaveLength(1)
    expect(channels.entries[0].kind).toBe('added')
    expect(channels.entries[0].label).toContain('Snare')
    expect(diff.summary).toBe('+1 channel')
  })

  it('reports a removed channel', () => {
    const diff = versions(
      setup(1, { inputs: [input({ id: 'a1' }), input({ id: 'a2', instrument: 'Snare' })] }),
      setup(1, { inputs: [input({ id: 'a1' })] }),
    )

    const channels = diff.sections.find((s) => s.title === 'Channels')!
    expect(channels.entries[0].kind).toBe('removed')
    expect(diff.summary).toBe('−1 channel')
  })

  // The reason rows are matched on a stable key rather than by position: an
  // edited row has to read as one change, not as a deletion and an unrelated
  // addition that the engineer then has to reconcile by eye.
  it('reports an edited channel as one change with the field that moved', () => {
    const diff = versions(
      setup(1, { inputs: [input({ id: 'a1', mic_di: 'Mic' })] }),
      setup(1, { inputs: [input({ id: 'a1', mic_di: 'Mic+DI' })] }),
    )

    const channels = diff.sections.find((s) => s.title === 'Channels')!
    expect(channels.entries).toHaveLength(1)
    expect(channels.entries[0].kind).toBe('changed')
    expect(channels.entries[0].changes).toEqual(['mic/DI: Mic → Mic+DI'])
    expect(diff.summary).toBe('1 channel changed')
  })

  it('lists every field that moved on one row', () => {
    const diff = versions(
      setup(1, { inputs: [input({ id: 'a1', mic_model: 'D112', notes: '' })] }),
      setup(1, { inputs: [input({ id: 'a1', mic_model: 'Beta91A', notes: 'Inside' })] }),
    )

    const entry = diff.sections[0].entries[0]
    expect(entry.changes).toEqual(['model: D112 → Beta91A', 'notes: — → Inside'])
  })

  // Reordering changes the printed channel numbers but not what is plugged in,
  // and a rider that shouts "12 channels changed" after a drag is a rider
  // nobody reads twice.
  it('does not report a reorder as a content change', () => {
    const rig = setup(1, { inputs: [input({ id: 'a1' }), input({ id: 'a2', instrument: 'Snare' })] })
    const before = rider({ placements: [placement({ id: 'p1', setup_id: 1 })] })
    const after = rider({
      placements: [placement({ id: 'p1', setup_id: 1 })],
      channel_order: ['p1:a2', 'p1:a1'],
    })

    const diff = diffRiders(snapshot(1, before, [rig]), snapshot(2, after, [rig]))

    expect(diff.identical).toBe(true)
  })

  it('reports a monitor turning into an IEM', () => {
    const diff = versions(
      setup(1, { monitors: [monitor({ id: 'm1', type: 'wedge' })] }),
      setup(1, { monitors: [monitor({ id: 'm1', type: 'iem' })] }),
    )

    const monitors = diff.sections.find((s) => s.title === 'Monitors')!
    expect(monitors.entries[0].changes).toEqual(['type: wedge → iem'])
  })

  it('reports backline and RF changes in their own sections', () => {
    const diff = versions(
      setup(1, {
        backline: [backline({ id: 'b1', brand_preference: 'Yamaha' })],
        wireless: [wireless({ id: 'w1', frequency_band: 'Z2' })],
      }),
      setup(1, {
        backline: [backline({ id: 'b1', brand_preference: 'Pearl' })],
        wireless: [wireless({ id: 'w1', frequency_band: 'K8' })],
      }),
    )

    expect(diff.sections.map((s) => s.title)).toEqual(['Backline', 'RF / Wireless'])
  })

  it('reports a change in outlets as a power change', () => {
    const diff = versions(
      setup(1, { power: { outlets_needed: 2, notes: '' } }),
      setup(1, { power: { outlets_needed: 4, notes: '' } }),
    )

    const power = diff.sections.find((s) => s.title === 'Power')!
    expect(power.entries[0].changes).toEqual(['outlets: 2 → 4'])
  })

  it('summarises several sections at once', () => {
    const diff = versions(
      setup(1, { inputs: [input({ id: 'a1' })], monitors: [monitor({ id: 'm1', type: 'wedge' })] }),
      setup(1, {
        inputs: [input({ id: 'a1' }), input({ id: 'a2' })],
        monitors: [monitor({ id: 'm1', type: 'iem' })],
      }),
    )

    expect(diff.summary).toBe('+1 channel · 1 monitor changed')
  })

  it('pluralises by count', () => {
    const diff = versions(
      setup(1, { inputs: [input({ id: 'a1' })] }),
      setup(1, {
        inputs: [input({ id: 'a1' }), input({ id: 'a2' }), input({ id: 'a3' })],
      }),
    )

    expect(diff.summary).toBe('+2 channels')
  })

  it('names the musician a changed row belongs to', () => {
    const before = rider({ placements: [placement({ id: 'p1', setup_id: 1, band_member_id: 4 })] })

    const diff = diffRiders(
      snapshot(1, before, [setup(1, { inputs: [input({ id: 'a1', mic_di: 'Mic' })] })], [member({ id: 4, nickname: 'Marek' })]),
      snapshot(2, before, [setup(1, { inputs: [input({ id: 'a1', mic_di: 'DI' })] })], [member({ id: 4, nickname: 'Marek' })]),
    )

    expect(diff.sections[0].entries[0].source).toBe('Marek')
  })
})

describe('resolveSnapshot', () => {
  // The whole point of freezing: a snapshot must not consult the live library.
  it('resolves against the setups frozen inside it', () => {
    const frozen = setup(1, { name: 'As sent', inputs: [input({ instrument: 'Kick' })] })
    const draft = rider({ placements: [placement({ setup_id: 1 })] })

    const resolved = resolveSnapshot(snapshot(1, draft, [frozen]))

    expect(resolved.inputs.map((i) => i.instrument)).toEqual(['Kick'])
    expect(resolved.inputs[0].source.detail).toBe('As sent')
  })

  it('survives a snapshot whose placements reference nothing', () => {
    const resolved = resolveSnapshot(snapshot(1, rider(), []))

    expect(resolved.inputs).toEqual([])
  })
})
