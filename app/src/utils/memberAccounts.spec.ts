import { describe, expect, it } from 'vitest'
import { linkedMemberOwners, type MemberLinkedUser } from './memberAccounts'

const user = (id: number, band_member_id: number | null): MemberLinkedUser =>
  ({ id, first_name: `U${id}`, last_name: 'X', band_member_id })

describe('linkedMemberOwners', () => {
  it('maps each linked member to its user', () => {
    const owners = linkedMemberOwners([user(1, 10), user(2, null), user(3, 30)])
    expect([...owners.keys()].sort()).toEqual([10, 30])
    expect(owners.get(10)?.id).toBe(1)
  })

  it('leaves the edited user\'s own member selectable', () => {
    const owners = linkedMemberOwners([user(1, 10), user(3, 30)], 1)
    expect(owners.has(10)).toBe(false)
    expect(owners.has(30)).toBe(true)
  })

  it('ignores users with no member', () => {
    expect(linkedMemberOwners([user(1, null)]).size).toBe(0)
  })
})
