import { internet, name, phone as phoneFaker } from 'faker';
import { Caregiver, Relationship } from '../src';
import { generateId, generateObjectId } from '@argus/pandora';

export const mockGenerateCaregiver = ({
  id = generateId(),
  memberId = generateObjectId(),
  firstName = name.firstName(),
  lastName = name.lastName(),
  email = internet.email(),
  phone = phoneFaker.phoneNumber(),
  relationship = Relationship.parent,
}: Partial<Caregiver> = {}): Caregiver => {
  return {
    id,
    memberId,
    firstName,
    lastName,
    email,
    phone,
    relationship,
  };
};
