import { describe, it, expect } from 'vitest'
import { normaliseAdminPath, adminUrl, ADMIN_PATH } from './admin'

describe('normaliseAdminPath', () => {
  it('defaults to "admin" when nothing is configured', () => {
    expect(normaliseAdminPath(undefined)).toBe('admin')
    expect(normaliseAdminPath(null)).toBe('admin')
    expect(normaliseAdminPath('')).toBe('admin')
  })

  it('strips slashes people naturally type around a path', () => {
    expect(normaliseAdminPath('/backstage')).toBe('backstage')
    expect(normaliseAdminPath('backstage/')).toBe('backstage')
    expect(normaliseAdminPath('/backstage/')).toBe('backstage')
    expect(normaliseAdminPath('//backstage//')).toBe('backstage')
  })

  // A value of "/" would otherwise normalise to "", and adminUrl() would then
  // return "/" — mounting the entire admin panel at the site root, where it
  // shadows every public page. Falling back to 'admin' keeps that unreachable.
  it('falls back rather than yielding an empty segment', () => {
    expect(normaliseAdminPath('/')).toBe('admin')
    expect(normaliseAdminPath('///')).toBe('admin')
  })

  it('leaves an already-clean segment alone', () => {
    expect(normaliseAdminPath('admin')).toBe('admin')
    expect(normaliseAdminPath('stage-door')).toBe('stage-door')
  })
})

describe('adminUrl', () => {
  it('builds the panel root and its children', () => {
    expect(adminUrl()).toBe(`/${ADMIN_PATH}`)
    expect(adminUrl('concerts')).toBe(`/${ADMIN_PATH}/concerts`)
    expect(adminUrl('concerts/5/tickets')).toBe(`/${ADMIN_PATH}/concerts/5/tickets`)
  })

  it('tolerates a leading slash on the sub-path', () => {
    expect(adminUrl('/concerts')).toBe(`/${ADMIN_PATH}/concerts`)
  })

  // With no VITE_ADMIN_PATH set the build must reproduce today's URLs exactly,
  // so an unopted-in deploy and the whole E2E suite keep working untouched.
  it('defaults to the historical /admin URLs', () => {
    expect(ADMIN_PATH).toBe('admin')
    expect(adminUrl('venues')).toBe('/admin/venues')
  })
})
