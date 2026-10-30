/**
 * Enhance always replaces the row — that is its point — so it always leaves
 * an Undo behind: the text before the LATEST rewrite, offered only while the
 * row still shows that rewrite. The band's own edit on top of it ends the
 * offer; a second rewrite starts a new one from the first rewrite's text.
 */
export interface UndoState {
  before: string
  after: string
}

export function snapshot(before: string, after: string): UndoState {
  return { before, after }
}

export function canRestore(state: UndoState | null | undefined, current: string): boolean {
  return !!state && current === state.after
}
