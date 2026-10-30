import { describe, expect, it } from 'vitest'
import type { Lang, TranslationBag } from '@/locales'
import { applyFill, emptyTargets, planFill } from './translationFill'

const [a, b, c] = ['aa', 'bb', 'cc'] as unknown as Lang[]
const bag = (v: Partial<Record<string, string>>): TranslationBag => v as TranslationBag

describe('emptyTargets', () => {
  it('lists the empty locales in content order', () => {
    expect(emptyTargets(bag({ [a]: 'x', [b]: '', [c]: ' ' }), [c, b, a])).toEqual([c, b])
  })
})

describe('planFill', () => {
  it('plans one item per empty locale that has a source, none for filled ones', () => {
    const items = planFill(
      { title: bag({ [a]: 'T', [b]: '' }), body: bag({ [a]: '', [b]: '' }) },
      [a, b],
      { title: 'text', body: 'html' },
    )
    expect(items).toEqual([{ key: `title.${b}`, text: 'T', format: 'text', source: a, target: b }])
  })

  it('uses each field its own source', () => {
    const items = planFill(
      { title: bag({ [a]: 'T', [b]: '' }), intro: bag({ [a]: '', [b]: 'I' }) },
      [a, b],
      { title: 'text', intro: 'text' },
    )
    expect(items).toEqual([
      { key: `title.${b}`, text: 'T', format: 'text', source: a, target: b },
      { key: `intro.${a}`, text: 'I', format: 'text', source: b, target: a },
    ])
  })
})

describe('applyFill', () => {
  it('writes only into locales that are still empty at apply time', () => {
    const fields = { title: bag({ [a]: 'T', [b]: 'typed meanwhile' }), intro: bag({ [a]: 'I', [b]: '' }) }
    const out = applyFill(fields, { [`title.${b}`]: 'X', [`intro.${b}`]: 'Y' })
    expect(out.title[b]).toBe('typed meanwhile')
    expect(out.intro[b]).toBe('Y')
  })

  it('does not mutate the input', () => {
    const fields = { title: bag({ [a]: 'T', [b]: '' }) }
    applyFill(fields, { [`title.${b}`]: 'X' })
    expect(fields.title[b]).toBe('')
  })

  it('ignores keys for fields it does not know', () => {
    const fields = { title: bag({ [a]: 'T', [b]: '' }) }
    expect(applyFill(fields, { [`ghost.${b}`]: 'X' })).toEqual(fields)
  })
})
