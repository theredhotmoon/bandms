import { describe, expect, it } from 'vitest'
import { concertLineup, isHighlighted, lineupCaption, ourStageTime, runningOrderNumber, showsLineupRoles } from './lineup'

const guest = (name: string, sort_order: number, play_time: string | null = null) => ({
  id: sort_order, name, website: null, sort_order, play_time,
})

describe('concertLineup', () => {
  it('includes our own band, not just the guests', () => {
    const lineup = concertLineup({ bands: [guest('Support Act', 2)], own_sort_order: 1, start_time: '21:00' }, 'Skanking Storks')

    expect(lineup.map((e) => e.name)).toEqual(['Skanking Storks', 'Support Act'])
    expect(lineup[0]).toMatchObject({ own: true, play_time: '21:00' })
    expect(lineup[1]).toMatchObject({ own: false })
  })

  it('places our band at its saved position among the guests', () => {
    // The admin numbers one sequence for everyone: our slot is own_sort_order,
    // each guest's is its pivot sort_order.
    const lineup = concertLineup(
      { bands: [guest('Headliner', 1, '22:00'), guest('Opener', 3, '19:30')], own_sort_order: 2, start_time: '20:45' },
      'Skanking Storks',
    )

    expect(lineup.map((e) => e.name)).toEqual(['Headliner', 'Skanking Storks', 'Opener'])
  })

  it('lists our band alone when there are no guests', () => {
    const lineup = concertLineup({ bands: [], own_sort_order: 1, start_time: null }, 'Skanking Storks')

    expect(lineup).toEqual([{ name: 'Skanking Storks', play_time: null, own: true }])
  })

  it('puts our band first on a tied position', () => {
    // Rows saved before own_sort_order existed default it to 1, which can
    // collide with a guest's 1. A stable, predictable order beats either guess.
    const lineup = concertLineup({ bands: [guest('Guest', 1)], own_sort_order: 1, start_time: null }, 'Skanking Storks')

    expect(lineup.map((e) => e.name)).toEqual(['Skanking Storks', 'Guest'])
  })

  it("prints our band's own stage time rather than the show's start", () => {
    // Headlining a four-band bill: the show starts at 19:00 with the opener,
    // we are on at 23:00. start_time is the former, own_play_time the latter.
    const lineup = concertLineup(
      { bands: [guest('Opener', 2, '19:00')], own_sort_order: 1, start_time: '19:00', own_play_time: '23:00' },
      'Skanking Storks',
    )

    expect(lineup[0]).toMatchObject({ own: true, play_time: '23:00' })
  })

  it('falls back to start_time when our stage time is unset', () => {
    for (const own_play_time of [null, undefined]) {
      const lineup = concertLineup({ bands: [], own_sort_order: 1, start_time: '21:00', own_play_time }, 'Us')
      expect(lineup[0].play_time).toBe('21:00')
    }
  })

  it('does not reorder the bands array it was given', () => {
    const bands = [guest('B', 3), guest('A', 2)]
    concertLineup({ bands, own_sort_order: 1, start_time: null }, 'Us')

    expect(bands.map((b) => b.name)).toEqual(['B', 'A'])
  })
})

describe('lineupCaption', () => {
  const labels = { headliner: 'Headliner', support: 'Support' }
  const fmt = (t: string) => t.slice(0, 5)

  it('bills the first act as headliner and the rest as support, with their times', () => {
    expect(lineupCaption(0, { play_time: '21:00:00' }, true, labels, fmt)).toBe('Headliner · 21:00')
    expect(lineupCaption(1, { play_time: null }, true, labels, fmt)).toBe('Support')
  })

  it('leaves only the time when the band switched the roles off', () => {
    expect(lineupCaption(0, { play_time: '21:00' }, false, labels, fmt)).toBe('21:00')
    expect(lineupCaption(2, { play_time: '19:30' }, false, labels, fmt)).toBe('19:30')
  })

  it('prints nothing for an untimed act with the roles off', () => {
    // '' lets the page drop the caption element instead of an empty line.
    expect(lineupCaption(1, { play_time: null }, false, labels, fmt)).toBe('')
  })

})

describe('isHighlighted', () => {
  it('follows the billing when the roles are on — the top act, even a guest', () => {
    expect(isHighlighted(0, { own: false }, true)).toBe(true)
    expect(isHighlighted(1, { own: true }, true)).toBe(false)
  })

  it('highlights our band wherever it plays when the roles are off', () => {
    expect(isHighlighted(1, { own: true }, false)).toBe(true)
    expect(isHighlighted(0, { own: false }, false)).toBe(false)
  })
})

describe('showsLineupRoles', () => {
  it('follows the flag', () => {
    expect(showsLineupRoles({ show_lineup_roles: true })).toBe(true)
    expect(showsLineupRoles({ show_lineup_roles: false })).toBe(false)
  })

  it('keeps the labels for a concert served without the flag', () => {
    expect(showsLineupRoles({})).toBe(true)
  })
})

describe('runningOrderNumber', () => {
  it('numbers the billing-ordered list in the order the acts play', () => {
    // Headliner on top of the bill, on stage last.
    expect([0, 1, 2, 3, 4].map((i) => runningOrderNumber(i, 5))).toEqual(['05', '04', '03', '02', '01'])
  })

  it('gives a lone act 01', () => {
    expect(runningOrderNumber(0, 1)).toBe('01')
  })
})

describe('ourStageTime', () => {
  it("prefers our own slot over the show's start", () => {
    expect(ourStageTime({ start_time: '19:00', own_play_time: '23:00' })).toBe('23:00')
  })

  it('falls back to the start, or to nothing', () => {
    expect(ourStageTime({ start_time: '21:00', own_play_time: null })).toBe('21:00')
    expect(ourStageTime({ start_time: '21:00' })).toBe('21:00')
    expect(ourStageTime({ start_time: null, own_play_time: null })).toBeNull()
  })
})
