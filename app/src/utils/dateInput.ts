/**
 * A `datetime-local` input wants `YYYY-MM-DDTHH:mm` in the user's own zone;
 * `Date#toISOString()` gives UTC, which is wrong by the zone offset for
 * everyone outside Greenwich. Seconds are dropped because the input has no
 * seconds field and the API stores what it is given.
 */
export function localDateTimeInputValue(date: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}
