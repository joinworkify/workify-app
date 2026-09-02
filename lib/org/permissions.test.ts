import { canActOnMember } from './permissions';

describe('canActOnMember', () => {
  it('lets an owner act on anyone', () => {
    expect(canActOnMember('owner', 'owner')).toBe(true);
    expect(canActOnMember('owner', 'admin')).toBe(true);
    expect(canActOnMember('owner', 'member')).toBe(true);
  });

  it('lets an admin act only on members', () => {
    expect(canActOnMember('admin', 'member')).toBe(true);
    expect(canActOnMember('admin', 'admin')).toBe(false);
    expect(canActOnMember('admin', 'owner')).toBe(false);
  });

  it('never lets a member act on anyone', () => {
    expect(canActOnMember('member', 'member')).toBe(false);
    expect(canActOnMember('member', 'admin')).toBe(false);
    expect(canActOnMember('member', 'owner')).toBe(false);
  });
});
