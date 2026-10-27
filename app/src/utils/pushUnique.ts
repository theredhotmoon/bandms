/**
 * Tick an id into a selection, never un-tick it — what a picker does with a
 * record the user just created beside it. A plain push would double an id
 * already there and the checkbox would then read as un-ticked after one
 * toggle.
 */
export function pushUnique(ids: number[], id: number): void {
  if (!ids.includes(id)) ids.push(id)
}
