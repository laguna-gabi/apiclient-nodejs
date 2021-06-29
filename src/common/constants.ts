export const Errors = {
  coach: {
    create: {
      title: 'Failed to create a coach',
      reasons: {
        email: 'email already exists',
        role: 'coach role should be one of the following',
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
