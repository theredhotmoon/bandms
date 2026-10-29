import { describe, expect, it } from 'vitest'
import { hasMemberPage } from './memberPages'
import type { ModuleConfig } from './cms'

const cfg = (visibility?: Record<string, boolean>, modules: Record<string, boolean> = {}) => ({
  modules,
  module_config: (visibility === undefined ? {} : { about: { visibility } }) as Record<string, ModuleConfig>,
})

const member = { slug: 'jan-kowalski', public_page: true }

// The rule's own cases live with the rule, in
// packages/rider-core/src/memberPage.spec.ts. These pin the adapter: that site
// config reaches the rule, and that a slug is required on top of it.
describe('hasMemberPage', () => {
  it('builds a page while nothing says otherwise — an API predating the switch keeps its pages', () => {
    expect(hasMemberPage(cfg(), member)).toBe(true)
    expect(hasMemberPage(cfg(), { slug: 'jan-kowalski' })).toBe(true)
  })

  it('reads the About module flag and its visibility bag from site config', () => {
    expect(hasMemberPage(cfg({}, { about: false }), member)).toBe(false)
    expect(hasMemberPage(cfg({ show_members: false }), member)).toBe(false)
    expect(hasMemberPage(cfg({ member_pages: false }), member)).toBe(false)
  })

  it('honours the member opting out', () => {
    expect(hasMemberPage(cfg({ member_pages: true }), { ...member, public_page: false })).toBe(false)
  })

  it('builds nothing for a member with no slug', () => {
    expect(hasMemberPage(cfg(), { slug: '', public_page: true })).toBe(false)
  })
})
