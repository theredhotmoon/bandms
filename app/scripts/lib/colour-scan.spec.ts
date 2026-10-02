import { describe, expect, it } from 'vitest'
// @ts-expect-error — a plain .mjs build script, no type declarations
import { colourHits } from './colour-scan.mjs'

type Hit = { line: number; hits: string[] }
const css = (src: string): Hit[] => colourHits(src, 'css')
const vue = (src: string): Hit[] => colourHits(src, 'vue')

describe('colourHits — CSS', () => {
  it('flags a hex value and reports its line', () => {
    expect(css('.a {\n  color: #2a2a2a;\n}')).toEqual([{ line: 2, hits: ['#2a2a2a'] }])
  })

  it('accepts palette variables and color-mix over them', () => {
    expect(css('.a { color: var(--c-2a2a2a); background: color-mix(in srgb, var(--c-f87171) 13%, transparent); }')).toEqual([])
  })

  it('flags every short and alpha hex form', () => {
    expect(css('.a { color: #fff; background: #ffffff80; border-color: #abcd; }')[0].hits)
      .toEqual(['#fff', '#ffffff80', '#abcd'])
  })

  it('does not mistake an id selector for a colour', () => {
    expect(css('#app {\n  display: flex;\n}')).toEqual([])
    expect(css('#app, #add,\n.b { color: var(--c-111111); }')).toEqual([])
  })

  it('ignores colours inside comments, including multi-line ones', () => {
    expect(css('.a { color: var(--c-111111); } /* was #111 */')).toEqual([])
    expect(css('/*\n  old: #222222\n*/\n.a { color: #333; }')).toEqual([{ line: 4, hits: ['#333'] }])
  })

  it('allows black rgba — shadows and scrims look the same in both themes', () => {
    expect(css('.a { box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4); }')).toEqual([])
  })

  it('flags any other rgb/hsl function', () => {
    expect(css('.a { background: rgba(255, 255, 255, 0.1); }')[0].hits).toEqual(['rgba(255, 255, 255, 0.1)'])
    expect(css('.a { color: hsl(200 50% 50%); }')[0].hits).toEqual(['hsl(200 50% 50%)'])
  })

  it('flags white/black only as a colour value', () => {
    expect(css('.a { color: white; }')[0].hits).toEqual(['color: white'])
    expect(css('.a { white-space: nowrap; font-weight: black; }')).toEqual([])
  })

  it('skips a line carrying the ignore marker', () => {
    expect(css('.btn { color: #fff; } /* token-lint-ignore: white on teal */')).toEqual([])
  })
})

describe('colourHits — Vue SFC', () => {
  it('reads <style> but never <script>', () => {
    const src = [
      '<script setup lang="ts">',
      "const BRAND = '#1db954'",
      '</script>',
      '<template><div /></template>',
      '<style scoped>',
      '.a { color: #94a3b8; }',
      '</style>',
    ].join('\n')
    expect(vue(src)).toEqual([{ line: 6, hits: ['#94a3b8'] }])
  })

  it('handles a one-line style block', () => {
    expect(vue('<template><i /></template>\n<style>.a { color: #111 }</style>')).toEqual([{ line: 2, hits: ['#111'] }])
  })

  it('flags colours in style and :style attributes', () => {
    const src = '<template>\n  <p style="color:#475569;">x</p>\n  <p :style="ok ? \'color:#34d399\' : \'\'">y</p>\n</template>'
    expect(vue(src)).toEqual([
      { line: 2, hits: ['#475569'] },
      { line: 3, hits: ['#34d399'] },
    ])
  })

  it('accepts var() in a style attribute', () => {
    expect(vue('<template>\n  <p style="color:var(--c-475569);">x</p>\n</template>')).toEqual([])
  })

  it('flags Tailwind arbitrary colours in a class list', () => {
    expect(vue('<template>\n  <div class="p-2 bg-[#141414] hover:border-[#333]" />\n</template>')[0].hits)
      .toEqual(['bg-[#141414]', 'hover:border-[#333]'])
  })

  it('allows text-[#fff], the documented pinned-white label', () => {
    expect(vue('<template>\n  <button class="bg-teal-600 text-[#fff] hover:text-[#fff]" />\n</template>')).toEqual([])
    expect(vue('<template>\n  <button class="bg-[#fff]" />\n</template>')).toHaveLength(1)
  })

  it('ignores a slot shorthand that happens to look like hex', () => {
    expect(vue('<template>\n  <Card>\n    <template #add>x</template>\n  </Card>\n</template>')).toEqual([])
  })
})
