/**
 * A `time` input's value, `HH:mm`, from an API time. MySQL `TIME` columns come
 * back as `HH:mm:ss`; a `time` input shows that with a seconds field, and a
 * form that loads one copy trimmed and another not reads as edited the moment
 * it opens. Missed for a concert's guest-band play times, which then went back
 * to the API with their seconds — rejected until the API learned to accept them.
 */
export function timeInputValue(time: string | null | undefined): string {
  return (time ?? '').slice(0, 5)
}

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
