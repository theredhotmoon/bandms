/**
 * The resolver decides what a venue is sent.
 *
 * Every surface — the admin editor, the preview, the public page, and now the
 * version diff — calls `resolveRider`, so a bug here is a bug in the printed
 * sheet on all four at once. These tests exist because that is the highest
 * concentration of consequence in the codebase, and because Playwright only
 * ever walks the happy path through it.
 */

import { describe, expect, it } from 'vitest'
import {
  applyChannelOrder,
  overriddenFields,
  placementName,
  resolveRider,
  resolveRig,
  riderCompleteness,
} from './riderResolver'
import type { ResolvedInput } from './riderResolver'
import {
  backline,
  input,
  lookup,
  member,
  monitor,
  placement,
  rider,
  setup,
  wireless,
} from './__fixtures__/rider'

// ── resolveRig: reference + override ──────────────────────────────────────────

describe('resolveRig', () => {
  it('takes the saved rig when the placement overrides nothing', () => {
    const saved = setup(7, { inputs: [input({ instrument: 'Kick' })], foh_notes: 'Loud' })
    const rig = resolveRig(placement({ setup_id: 7 }), lookup(saved))

    expect(rig.inputs).toHaveLength(1)
    expect(rig.inputs[0].instrument).toBe('Kick')
    expect(rig.foh_notes).toBe('Loud')
  })

  it('lets an override replace the saved value for this gig only', () => {
    const saved = setup(7, { inputs: [input({ instrument: 'Kick' })] })
    const rig = resolveRig(
      placement({ setup_id: 7, overrides: { inputs: [input({ id: 'in-2', instrument: 'Snare' })] } }),
      lookup(saved),
    )

    expect(rig.inputs.map((i) => i.instrument)).toEqual(['Snare'])
    // The library row is untouched — the override is a patch, not a write.
    expect(saved.inputs[0].instrument).toBe('Kick')
  })

  it('merges per field, so an untouched field still comes from the saved rig', () => {
    const saved = setup(7, {
      inputs: [input({ instrument: 'Kick' })],
      monitors: [monitor({ label: 'Saved wedge' })],
    })
    const rig = resolveRig(
      placement({ setup_id: 7, overrides: { inputs: [] } }),
      lookup(saved),
    )

    expect(rig.inputs).toEqual([])
    expect(rig.monitors[0].label).toBe('Saved wedge')
  })

  // The distinction that makes overrides usable at all: "no monitors tonight"
  // has to be expressible, and it looks identical to "no override" unless the
  // resolver checks for the key rather than for truthiness.
  it('treats an empty override list as a deliberate removal, not as absence', () => {
    const saved = setup(7, { monitors: [monitor()] })

    const removed = resolveRig(placement({ setup_id: 7, overrides: { monitors: [] } }), lookup(saved))
    const untouched = resolveRig(placement({ setup_id: 7, overrides: {} }), lookup(saved))

    expect(removed.monitors).toEqual([])
    expect(untouched.monitors).toHaveLength(1)
  })

  it('resolves a placement with no saved rig to its overrides alone', () => {
    const rig = resolveRig(
      placement({ setup_id: null, overrides: { inputs: [input({ instrument: 'Guest vox' })] } }),
      {},
    )

    expect(rig.inputs.map((i) => i.instrument)).toEqual(['Guest vox'])
  })

  it('resolves to an empty rig when the referenced setup is missing', () => {
    const rig = resolveRig(placement({ setup_id: 999 }), lookup(setup(7)))

    expect(rig.inputs).toEqual([])
    expect(rig.monitors).toEqual([])
  })

  it('reports which fields a placement overrides', () => {
    const p = placement({ overrides: { inputs: [], foh_notes: 'Tonight only' } })

    expect(overriddenFields(p)).toEqual(['inputs', 'foh_notes'])
  })
})

// ── resolveRider: the printed lists ───────────────────────────────────────────

describe('resolveRider', () => {
  it('numbers channels from 1 across all musicians', () => {
    const a = setup(1, { inputs: [input({ id: 'a1' }), input({ id: 'a2' })] })
    const b = setup(2, { inputs: [input({ id: 'b1' })] })

    const resolved = resolveRider(
      rider({
        placements: [
          placement({ id: 'p1', setup_id: 1 }),
          placement({ id: 'p2', setup_id: 2 }),
        ],
      }),
      lookup(a, b),
      [member()],
    )

    expect(resolved.inputs.map((i) => i.channel)).toEqual([1, 2, 3])
  })

  it('appends production extras after the musicians', () => {
    const saved = setup(1, { inputs: [input({ id: 'a1', instrument: 'Kick' })] })

    const resolved = resolveRider(
      rider({
        placements: [placement({ setup_id: 1 })],
        extra_inputs: [input({ id: 'x1', instrument: 'Talkback' })],
      }),
      lookup(saved),
      [member()],
    )

    expect(resolved.inputs.map((i) => i.instrument)).toEqual(['Kick', 'Talkback'])
    expect(resolved.inputs[1].source.kind).toBe('extra')
    expect(resolved.inputs[1].source.name).toBe('Production')
  })

  it('attributes every row to the musician it came from', () => {
    const saved = setup(1, { name: 'Acoustic kit', inputs: [input()] })

    const resolved = resolveRider(
      rider({ placements: [placement({ setup_id: 1, band_member_id: 4 })] }),
      lookup(saved),
      [member({ id: 4, nickname: 'Marek' })],
    )

    expect(resolved.inputs[0].source.name).toBe('Marek')
    expect(resolved.inputs[0].source.detail).toBe('Acoustic kit')
    expect(resolved.inputs[0].source.overridden).toBe(false)
  })

  // The second line under a musician's name on the printed sheet. Without a
  // saved rig it has to say something true rather than nothing at all.
  it('describes a musician with no saved rig by what they play', () => {
    const p = placement({
      setup_id: null,
      overrides: { inputs: [input()] },
      instruments: [
        { id: 'i1', type: 'electric_guitar', label: 'Guitar' },
        { id: 'i2', type: 'vocalist', label: 'Vocals' },
      ],
    })

    const resolved = resolveRider(rider({ placements: [p] }), {}, [member()])

    expect(resolved.inputs[0].source.detail).toBe('Guitar + Vocals')
  })

  it('says so plainly when there is neither a saved rig nor an instrument', () => {
    const p = placement({ setup_id: null, instruments: [], overrides: { inputs: [input()] } })

    const resolved = resolveRider(
      rider({ placements: [p] }),
      {},
      [member({ main_instrument: null, role: null })],
    )

    expect(resolved.inputs[0].source.detail).toBe('No saved rig')
  })

  it('lists production backline the promoter must supply', () => {
    const resolved = resolveRider(
      rider({ extra_backline: [backline({ id: 'x1', name: 'House DJ table' })] }),
      {},
      [],
    )

    expect(resolved.backline.map((b) => b.name)).toEqual(['House DJ table'])
    expect(resolved.backline[0].source.kind).toBe('extra')
  })

  it('marks a guest placement as a guest rather than a member', () => {
    const p = placement({ band_member_id: null, temp_id: 't1', overrides: { inputs: [input()] } })

    const resolved = resolveRider(
      rider({
        placements: [p],
        gig_lineup: { temp_musicians: [{ id: 't1', name: 'Tomek', role: 'Sax' }] },
      }),
      {},
      [],
    )

    expect(resolved.inputs[0].source.kind).toBe('guest')
    expect(resolved.inputs[0].source.name).toBe('Tomek (guest)')
  })

  it('flags a row whose field the placement overrides', () => {
    const saved = setup(1, { inputs: [input()] })

    const resolved = resolveRider(
      rider({
        placements: [placement({ setup_id: 1, overrides: { inputs: [input({ id: 'o1' })] } })],
      }),
      lookup(saved),
      [member()],
    )

    expect(resolved.inputs[0].source.overridden).toBe(true)
  })

  // Gear the musician brings is recorded on the rig but is not a request.
  it('lists only the backline the promoter has to supply', () => {
    const saved = setup(1, {
      backline: [
        backline({ id: 'need', name: 'Drum kit', needed: true }),
        backline({ id: 'own', name: 'Own snare', needed: false }),
      ],
    })

    const resolved = resolveRider(
      rider({ placements: [placement({ setup_id: 1 })] }),
      lookup(saved),
      [member()],
    )

    expect(resolved.backline.map((b) => b.name)).toEqual(['Drum kit'])
  })

  it('gives a musician a power position only when they need outlets', () => {
    const powered = setup(1, { power: { outlets_needed: 3, notes: 'Behind kit' } })
    const unpowered = setup(2, { power: { outlets_needed: 0, notes: '' } })

    const resolved = resolveRider(
      rider({
        placements: [
          placement({ id: 'p1', setup_id: 1, band_member_id: 4 }),
          placement({ id: 'p2', setup_id: 2, band_member_id: 5 }),
        ],
      }),
      lookup(powered, unpowered),
      [member({ id: 4, nickname: 'Marek' }), member({ id: 5, nickname: 'Ola' })],
    )

    expect(resolved.power.positions).toHaveLength(1)
    expect(resolved.power.positions[0].location).toBe('Marek')
    expect(resolved.power.total_outlets).toBe(3)
  })

  it('sums outlets across musicians', () => {
    const a = setup(1, { power: { outlets_needed: 2, notes: '' } })
    const b = setup(2, { power: { outlets_needed: 4, notes: '' } })

    const resolved = resolveRider(
      rider({
        placements: [
          placement({ id: 'p1', setup_id: 1 }),
          placement({ id: 'p2', setup_id: 2 }),
        ],
      }),
      lookup(a, b),
      [member()],
    )

    expect(resolved.power.total_outlets).toBe(6)
  })

  it('carries the stage-wide power notes through untouched', () => {
    const resolved = resolveRider(
      rider({ power_notes: { total_wattage: 3200, needs_clean_power: true, general_notes: 'No dimmers' } }),
      {},
      [],
    )

    expect(resolved.power.total_wattage).toBe(3200)
    expect(resolved.power.needs_clean_power).toBe(true)
    expect(resolved.power.general_notes).toBe('No dimmers')
  })

  it('collects monitors and RF from every musician and from the production', () => {
    const saved = setup(1, { monitors: [monitor({ id: 'm1' })], wireless: [wireless({ id: 'w1' })] })

    const resolved = resolveRider(
      rider({
        placements: [placement({ setup_id: 1 })],
        extra_monitors: [monitor({ id: 'm2', label: 'Side fill' })],
        extra_wireless: [wireless({ id: 'w2' })],
      }),
      lookup(saved),
      [member()],
    )

    expect(resolved.monitors).toHaveLength(2)
    expect(resolved.wireless).toHaveLength(2)
    expect(resolved.monitors[1].source.kind).toBe('extra')
  })

  it('gives every row a key that survives re-resolution', () => {
    const saved = setup(1, { inputs: [input({ id: 'a1' })] })
    const draft = rider({ placements: [placement({ id: 'p1', setup_id: 1 })] })

    const first = resolveRider(draft, lookup(saved), [member()])
    const second = resolveRider(draft, lookup(saved), [member()])

    expect(first.inputs[0].key).toBe('p1:a1')
    expect(second.inputs[0].key).toBe(first.inputs[0].key)
  })
})

// ── applyChannelOrder ─────────────────────────────────────────────────────────

describe('applyChannelOrder', () => {
  const rows = (...keys: string[]) => keys.map((key) => ({ key }) as ResolvedInput)

  it('leaves the rows alone when no order is saved', () => {
    expect(applyChannelOrder(rows('a', 'b'), []).map((r) => r.key)).toEqual(['a', 'b'])
  })

  it('puts the rows in the engineer\'s order', () => {
    expect(applyChannelOrder(rows('a', 'b', 'c'), ['c', 'a', 'b']).map((r) => r.key))
      .toEqual(['c', 'a', 'b'])
  })

  // Forgiving on purpose: the saved order must never need migrating when a
  // musician or a channel is added or removed.
  it('ignores keys that no longer resolve', () => {
    expect(applyChannelOrder(rows('a', 'b'), ['gone', 'b', 'a']).map((r) => r.key))
      .toEqual(['b', 'a'])
  })

  it('appends rows the saved order does not mention', () => {
    expect(applyChannelOrder(rows('a', 'b', 'new'), ['b', 'a']).map((r) => r.key))
      .toEqual(['b', 'a', 'new'])
  })

  it('renumbers channels after reordering', () => {
    const saved = setup(1, { inputs: [input({ id: 'a1' }), input({ id: 'a2' })] })
    const resolved = resolveRider(
      rider({
        placements: [placement({ id: 'p1', setup_id: 1 })],
        channel_order: ['p1:a2', 'p1:a1'],
      }),
      lookup(saved),
      [member()],
    )

    expect(resolved.inputs.map((r) => [r.key, r.channel])).toEqual([
      ['p1:a2', 1],
      ['p1:a1', 2],
    ])
  })
})

// ── Naming and completeness ───────────────────────────────────────────────────

describe('placementName', () => {
  it('prefers a nickname', () => {
    expect(placementName(placement({ band_member_id: 4 }), [member({ id: 4, nickname: 'Marek' })], []))
      .toBe('Marek')
  })

  it('falls back to the full name', () => {
    expect(placementName(placement({ band_member_id: 4 }), [member({ id: 4 })], []))
      .toBe('Marek Kowalski')
  })

  it('names a guest from the gig lineup', () => {
    const p = placement({ band_member_id: null, temp_id: 't1' })

    expect(placementName(p, [], [{ id: 't1', name: 'Tomek', role: 'Sax' }])).toBe('Tomek (guest)')
  })

  it('does not pretend to know a member who is gone', () => {
    expect(placementName(placement({ band_member_id: 99 }), [member()], [])).toBe('Member #99')
  })
})

describe('riderCompleteness', () => {
  it('counts a musician with an instrument, inputs and a monitor as ready', () => {
    const saved = setup(1, { inputs: [input()], monitors: [monitor()] })
    const p = placement({
      setup_id: 1,
      instruments: [{ id: 'i1', type: 'drums', label: 'Kit' }],
    })

    const result = riderCompleteness(rider({ placements: [p] }), lookup(saved), [member()])

    expect(result.complete).toBe(1)
    expect(result.pct).toBe(100)
    expect(result.statuses[0].missing).toEqual([])
  })

  it('names what each unready musician is missing', () => {
    const p = placement({ setup_id: null, instruments: [] })

    const result = riderCompleteness(rider({ placements: [p] }), {}, [member({ main_instrument: null, role: null })])

    expect(result.complete).toBe(0)
    expect(result.statuses[0].missing).toEqual(['instrument', 'inputs', 'monitor'])
  })

  it('reports 0% rather than dividing by zero on an empty stage plot', () => {
    const result = riderCompleteness(rider(), {}, [])

    expect(result.total).toBe(0)
    expect(result.pct).toBe(0)
  })
})
