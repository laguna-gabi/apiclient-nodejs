import { ValidationArguments, ValidationOptions, registerDecorator } from 'class-validator';
import { Types } from 'mongoose';

export function IsObjectId(options?: ValidationOptions) {
  return (object, propertyName: string) => {
    registerDecorator({
      name: 'isObjectId',
      target: object.constructor,
      propertyName,
      options,
      validator: {
        validate(value) {
          return Types.ObjectId.isValid(value) || value == undefined;
        },
      },
    });
  };
}

export function IsValidCarePlanTypeInput(options: ValidationOptions) {
  return (object, propertyName: string) => {
    registerDecorator({
      target: object.constructor,
      propertyName,
      options,
      validator: {
        validate(carePlanType: string, args: ValidationArguments) {
          return Boolean(args.object['type']['id']) !== Boolean(args.object['type']['custom']);
        },
      },
    });
  };
}
