export const validPhoneNumbersExamples =
  'Examples for a valid phone number: +41 311111111, +41 (0)31 633 60 01, +49 9072 1111, etc..';

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
        uniquePhoneNumber: 'phone number already exists',
        phoneNumberValidation:
          `phone number must be a valid phone number.` +
          `please make sure you've added the country code with (+) in the beginning.` +
          `${validPhoneNumbersExamples}`,
      },
    },
  },
};
