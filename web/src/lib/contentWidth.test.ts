import { describe, expect, it } from 'vitest'
import { contentWidthFor } from './contentWidth'
import type { ModuleConfig } from './cms'

const cfg = (module_config: Record<string, Partial<ModuleConfig>>) =>
  ({ module_config }) as { module_config: Record<string, ModuleConfig> }

describe('contentWidthFor', () => {
  it('reads limited from the module row', () => {
    expect(contentWidthFor(cfg({ contact: { content_width: 'limited' } }), 'contact')).toBe('limited')
  })

  it('reads full from the module row', () => {
    expect(contentWidthFor(cfg({ contact: { content_width: 'full' } }), 'contact')).toBe('full')
  })

  it('fails open to full when the API predates the column', () => {
    expect(contentWidthFor(cfg({ contact: {} }), 'contact')).toBe('full')
  })

  it('fails open to full for an unknown module or an empty config', () => {
    expect(contentWidthFor(cfg({}), 'contact')).toBe('full')
    expect(contentWidthFor(cfg({ contact: { content_width: 'limited' } }), undefined)).toBe('full')
  })
})
