import { describe, expect, it } from 'vitest'
import { memberPageBlocker } from './memberPage'

const about = (visibility: Record<string, boolean>, enabled = true) => ({ enabled, visibility })

describe('memberPageBlocker', () => {
  it('is null when the band offers member pages and the member has not opted out', () => {
    expect(memberPageBlocker(about({}), { public_page: true })).toBeNull()
    expect(memberPageBlocker(about({ member_pages: true }), {})).toBeNull()
  })

  it('blames the band when its member-pages switch, Members section or About page is off', () => {
    expect(memberPageBlocker(about({ member_pages: false }), { public_page: true })).toBe('band')
    expect(memberPageBlocker(about({ show_members: false }), { public_page: true })).toBe('band')
    expect(memberPageBlocker(about({}, false), { public_page: true })).toBe('band')
  })

  it('blames the member when they opted out', () => {
    expect(memberPageBlocker(about({}), { public_page: false })).toBe('member')
  })

  it('reports the band first: the member toggle only matters while the switch is on', () => {
    expect(memberPageBlocker(about({ member_pages: false }), { public_page: false })).toBe('band')
  })

  it('counts an unknown About module, or one with no visibility bag, as on', () => {
    expect(memberPageBlocker(undefined, {})).toBeNull()
    expect(memberPageBlocker({}, {})).toBeNull()
  })
})
