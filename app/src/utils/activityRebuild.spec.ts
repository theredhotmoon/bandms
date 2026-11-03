import { describe, expect, it } from 'vitest'
import { parseRebuildDiff } from './activityRebuild'

describe('parseRebuildDiff', () => {
  it('reads a manual rebuild with its areas and included edits', () => {
    const details = parseRebuildDiff({
      trigger: [null, 'manual'],
      areas: [null, ['concerts', 'faqs']],
      changes: [null, [
        { log_id: 4, at: '2026-11-03T10:00:00+00:00', user: 'Ada', action: 'updated', subject_type: 'Concert', subject_id: 9, subject_label: 'Warsaw' },
      ]],
    })

    expect(details).toEqual({
      trigger: 'manual',
      areas: ['concerts', 'faqs'],
      changes: [{ log_id: 4, at: '2026-11-03T10:00:00+00:00', user: 'Ada', action: 'updated', subject_type: 'Concert', subject_id: 9, subject_label: 'Warsaw' }],
      changesTotal: 1,
    })
  })

  it('gives an automatic rebuild no change list, not an empty one', () => {
    const details = parseRebuildDiff({ trigger: [null, 'auto'], areas: [null, ['posts']] })

    expect(details.trigger).toBe('auto')
    expect(details.changes).toBeNull()
  })

  it('drops malformed rows and unknown actions rather than throwing', () => {
    const details = parseRebuildDiff({
      areas: [null, ['shop', 7, '']],
      changes: [null, ['junk', null, { log_id: 'x' }, { log_id: 2, action: 'exploded' }]],
    })

    expect(details.trigger).toBe('manual')
    expect(details.areas).toEqual(['shop'])
    expect(details.changes).toEqual([
      { log_id: 2, at: null, user: null, action: 'other', subject_type: null, subject_id: null, subject_label: null },
    ])
  })

  it('reports the full count when the stored list was capped', () => {
    const details = parseRebuildDiff({
      changes: [null, [{ log_id: 9, action: 'updated' }]],
      changes_total: [null, 250],
    })

    expect(details.changes).toHaveLength(1)
    expect(details.changesTotal).toBe(250)
  })
})
