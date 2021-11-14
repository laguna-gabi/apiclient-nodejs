export type SystemRoles = {
  [K in RoleTypes]: {
    isAdmin: boolean;
    weight: number;
  };
};

export enum RoleTypes {
  User = 'User',
  Member = 'Member',
  Anonymous = 'Anonymous',
}

export const SystemRoles = {
  User: { isAdmin: true, weight: 100 },
  Member: { isAdmin: false, weight: 10 },
  Anonymous: { isAdmin: false, weight: 1 },
};
