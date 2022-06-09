import { date as fakerDate, internet, lorem, name, phone as phoneFaker } from 'faker';
import {
  Barrier,
  BarrierDomain,
  BarrierStatus,
  BarrierType,
  CarePlan,
  CarePlanStatus,
  CarePlanType,
  Caregiver,
  Relationship,
} from '../src';
import { generateId, generateObjectId, randomEnum } from '@argus/pandora';

export const mockGenerateCaregiver = ({
  id = generateId(),
  memberId = generateObjectId(),
  journeyId = generateObjectId(),
  firstName = name.firstName(),
  lastName = name.lastName(),
  email = internet.email(),
  phone = phoneFaker.phoneNumber(),
  relationship = Relationship.parent,
}: Partial<Caregiver> = {}): Caregiver => {
  return {
    id,
    memberId,
    journeyId,
    firstName,
    lastName,
    email,
    phone,
    relationship,
  };
};

export const mockGenerateCarePlan = ({
  id = generateId(),
  memberId = generateObjectId(),
  journeyId = generateObjectId(),
  createdAt = fakerDate.past(1),
  updatedAt = fakerDate.past(0.5),
  dueDate = fakerDate.future(0.5),
  status = CarePlanStatus.active,
  notes = lorem.words(),
  completedAt = updatedAt,
  type = mockGenerateCarePlanType(),
  barrierId = generateObjectId(),
  createdBy = generateObjectId(),
}: Partial<CarePlan> = {}): CarePlan => {
  return {
    id,
    memberId,
    journeyId,
    createdAt,
    updatedAt,
    dueDate,
    status,
    notes,
    completedAt,
    type,
    barrierId,
    createdBy,
  };
};

export const mockGenerateCarePlanType = ({
  id = generateId(),
  description = lorem.word(),
  isCustom = false,
}: Partial<CarePlanType> = {}): CarePlanType => {
  return {
    id,
    description,
    isCustom,
  };
};

export const mockGenerateBarrier = ({
  id = generateId(),
  memberId = generateObjectId(),
  journeyId = generateObjectId(),
  createdAt = fakerDate.past(1),
  updatedAt = fakerDate.past(0.5),
  status = BarrierStatus.active,
  notes = lorem.words(),
  completedAt = updatedAt,
  type = mockGenerateBarrierType(),
  redFlagId = generateObjectId(),
  createdBy = generateObjectId(),
}: Partial<Barrier> = {}): Barrier => {
  return {
    id,
    memberId,
    journeyId,
    createdAt,
    updatedAt,
    status,
    notes,
    completedAt,
    type,
    redFlagId,
    createdBy,
  };
};

export const mockGenerateBarrierType = ({
  id = generateId(),
  description = lorem.word(),
  domain = randomEnum(BarrierDomain) as BarrierDomain,
  carePlanTypes = [mockGenerateCarePlanType()],
}: Partial<BarrierType> = {}): BarrierType => {
  return {
    id,
    domain,
    description,
    carePlanTypes,
  };
};
