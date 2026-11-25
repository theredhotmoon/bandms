/**
 * A click the page handles itself; a modified or middle click is the browser's
 * (new tab, download…). Same rule in web/src/lib/fanAuth.ts.
 */
export function isPlainLeftClick(
  e: Pick<MouseEvent, 'button' | 'metaKey' | 'ctrlKey' | 'shiftKey' | 'altKey'>,
): boolean {
  return e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey
}
