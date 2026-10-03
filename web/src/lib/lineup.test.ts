import { describe, expect, it } from 'vitest'
import { concertLineup } from './lineup'

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

  it('does not reorder the bands array it was given', () => {
    const bands = [guest('B', 3), guest('A', 2)]
    concertLineup({ bands, own_sort_order: 1, start_time: null }, 'Us')

    expect(bands.map((b) => b.name)).toEqual(['B', 'A'])
  })
})
