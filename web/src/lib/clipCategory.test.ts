import { describe, it, expect } from 'vitest'
import { clipCategoryLabel } from './clipCategory'

const site = {
  clipCategoryLive: 'Na żywo', clipCategoryStudio: 'Studio', clipCategoryBackstage: 'Za kulisami',
  clipCategoryInterview: 'Wywiad', clipCategoryOther: 'Inne',
}

describe('clipCategoryLabel', () => {
  it('maps a preset to its copy label', () => {
    expect(clipCategoryLabel('live', site)).toBe('Na żywo')
    expect(clipCategoryLabel('backstage', site)).toBe('Za kulisami')
  })
  it('prints a custom category as typed', () => {
    expect(clipCategoryLabel('charity gig', site)).toBe('charity gig')
  })
})
