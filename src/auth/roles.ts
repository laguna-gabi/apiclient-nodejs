export type SystemRoles = {
  [K in Roles]: {
    isAdmin: boolean;
    weight: number;
  };
};

export enum Roles {
  User = 'User',
  Member = 'Member',
  Anonymous = 'Anonymous',
}

export const SystemRoles = {
  User: { isAdmin: true, weight: 100 },
  Member: { isAdmin: false, weight: 10 },
  Anonymous: { isAdmin: false, weight: 1 },
};

export function isAllowed(role: Roles, allowedRoles: Roles[]): boolean {
  if (SystemRoles[role].isAdmin) {
    return true;
  }

  // if we have an allowed role which has a lower weight we consider our role as allowed
  return allowedRoles.some((element) => {
    if (SystemRoles[element].weight <= SystemRoles[role].weight) return true;
    else return false;
  });
}
