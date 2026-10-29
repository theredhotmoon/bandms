/**
 * Whether a band member's page, /{lang}/{about}/{slug}, is built — the one
 * rule behind three surfaces that must agree: the public build deciding which
 * pages exist, the About grid deciding whether a card links to one, and the
 * admin deciding whether to offer a QR code for it. Two copies drifting apart
 * is a printed QR code that 404s, so both apps import it from here.
 *
 * Lives beside the BandMember type rather than in a rider module: it is member
 * domain code shared by app/ and web/, which is what this package is for.
 */

/** The About module as both apps can describe it: enabled flag plus its visibility bag. */
export interface AboutModuleState {
  enabled?: boolean
  visibility?: Readonly<Record<string, boolean>>
}

/**
 * Why a member's page is not built, or null when it is.
 *
 * - `band`: the About page, its Members section or its `member_pages` switch
 *   (Website modules → About) is off. Reported first: the member's own toggle
 *   only means something while the band offers member pages.
 * - `member`: the band offers member pages, but this member opted out.
 *
 * `!== false` throughout, never `=== true`: an absent key is an API predating
 * the switch, a module row that never saved the bag, or a config that failed
 * open mid-build — none of which may unbuild pages whose URLs are printed as
 * QR codes. An unknown About module (`undefined`) counts as on for the same
 * reason.
 */
export function memberPageBlocker(
  about: AboutModuleState | undefined,
  member: { public_page?: boolean },
): 'band' | 'member' | null {
  const v = about?.visibility ?? {}
  const bandOn = about?.enabled !== false && v.show_members !== false && v.member_pages !== false
  if (!bandOn) return 'band'
  return member.public_page === false ? 'member' : null
}
