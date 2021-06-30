export const Errors = {
  user: {
    create: {
      title: 'Failed to create a user',
      reasons: {
        email: 'email already exists',
        role: 'user roles should be any of the following',
      },
    },
  },
  member: {
    create: {
      title: 'Failed to create a member',
      reasons: {
        phoneNumber: 'phone number already exists',
      },
    },
  },
};
