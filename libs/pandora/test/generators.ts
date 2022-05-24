import { Types } from 'mongoose';

export const generateObjectId = (id?): Types.ObjectId => {
  return new Types.ObjectId(id);
};

export const generateId = (id?): string => {
  return generateObjectId(id).toString();
};

/*************************************************************************************************
 ******************************************** Helpers ********************************************
 ************************************************************************************************/
export function randomEnum<T>(enumType: T): string {
  const enumValues = Object.keys(enumType);
  const randomIndex = Math.floor(Math.random() * enumValues.length);
  return enumValues[randomIndex];
}
