/**
 * One login per band member: the API refuses a second user for a member who
 * already has one (`band_member_id` is unique), so the Users form greys those
 * members out instead of letting the save fail.
 */
export interface MemberLinkedUser {
  id: number
  first_name: string
  last_name: string
  band_member_id: number | null
}

/**
 * Map of band member id → the user already linked to it, skipping
 * `editingUserId` — a user may always keep (and re-save) their own member.
 */
export function linkedMemberOwners<U extends MemberLinkedUser>(
  users: readonly U[],
  editingUserId: number | null = null,
): Map<number, U> {
  const owners = new Map<number, U>()
  for (const u of users) {
    if (u.band_member_id === null || u.id === editingUserId) continue
    if (!owners.has(u.band_member_id)) owners.set(u.band_member_id, u)
  }
  return owners
}
