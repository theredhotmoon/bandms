import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/**
 * The light palette is generated colour by colour, so nothing ties a tinted
 * background to the text drawn on it. The first cut inverted them separately
 * and red delete buttons, green publish buttons and the language badges all
 * fell to ~2:1 — readable in dark, washed out in light. These are those pairs.
 */
const css = readFileSync(fileURLToPath(new URL('../admin-palette.css', import.meta.url)), 'utf8')
const [darkBlock, lightBlock] = css.split(':root[data-admin-theme="light"]')

function palette(block: string): Record<string, string> {
  return Object.fromEntries([...block.matchAll(/--c-([0-9a-f]{6}): (#[0-9a-f]{6});/g)].map((m) => [m[1], m[2]]))
}

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function contrast(a: string, b: string): number {
  const [lo, hi] = [luminance(a), luminance(b)].sort((x, y) => x - y)
  return (hi + 0.05) / (lo + 0.05)
}

const dark = palette(darkBlock)
const light = palette(lightBlock)

// [text, background, where it shows up]
const PAIRS: [string, string, string][] = [
  ['fca5a5', '7f1d1d', 'destructive button (ConfirmDialog)'],
  ['fca5a5', '991b1b', 'destructive button, hover'],
  ['34d399', '14532d', 'publish / success button'],
  ['4ade80', '14532d', 'success badge'],
  ['86efac', '14532d', 'live badge'],
  ['dcfce7', '166534', 'saved-state button'],
  ['60a5fa', '1e3a5f', 'language / provider badge'],
  ['93c5fd', '1e3a5f', 'language badge'],
  ['e2e8f0', '0a0a0a', 'body text on the shell'],
  ['94a3b8', '141414', 'secondary text on a card'],
]

describe('admin palette', () => {
  it('defines the same variables in both themes', () => {
    expect(Object.keys(light).sort()).toEqual(Object.keys(dark).sort())
  })

  it.each(PAIRS)('%s on %s stays readable in light mode (%s)', (fg, bg) => {
    expect(contrast(light[fg], light[bg])).toBeGreaterThanOrEqual(4.5)
  })
})
