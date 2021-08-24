import { registerDecorator, ValidationArguments, ValidationOptions } from 'class-validator';

/**
 * When there are 2 params of dates, and we want to make sure that one param is
 * before the other, we can use this custom validator.
 * <<Important assumption>>: both dates have 2 decorators: IsDate and IsDateAfter.
 * If start and/or end are not dates, it will be caught on IsDate() validators,
 * we don't want to print IsDateAfter error, its enough to print IsDate error.
 */
export function IsDateAfter(property: string, options?: ValidationOptions) {
  return (object, propertyName: string) => {
    registerDecorator({
      target: object.constructor,
      propertyName,
      constraints: [property],
      options,
      validator: {
        validate(end, args: ValidationArguments) {
          const [relatedPropertyName] = args.constraints;
          const start = args.object[relatedPropertyName];
          if (!isNaN(start?.getTime()) && !isNaN(end?.getTime())) {
            return start.getTime() < end.getTime();
          }
          return true;
        },
      },
    });
  };
}

export function IsFutureDate(options?: ValidationOptions) {
  return (object, propertyName: string) => {
    registerDecorator({
      target: object.constructor,
      propertyName,
      options,
      validator: {
        validate(date?: Date) {
          return date?.getTime() > new Date().getTime();
        },
      },
    });
  };
}

export function IsNoShowValid(options?: ValidationOptions) {
  return (object, propertyName: string) => {
    registerDecorator({
      target: object.constructor,
      propertyName,
      options,
      validator: {
        validate(reason, args: ValidationArguments) {
          const noShow = args.object['noShow'];
          return (!noShow && !reason) || (reason && noShow);
        },
      },
    });
  };
}

export function IsPrimaryUserInUsers(options: ValidationOptions) {
  return (object, propertyName: string) => {
    registerDecorator({
      target: object.constructor,
      propertyName,
      options,
      validator: {
        validate(users: string[], args: ValidationArguments) {
          const primaryUser = args.object['primaryUserId'];
          return users.indexOf(primaryUser) >= 0;
        },
      },
    });
  };
}

export function IsUserIdOrAppointmentId(options: ValidationOptions) {
  return (object, propertyName: string) => {
    registerDecorator({
      target: object.constructor,
      propertyName,
      options,
      validator: {
        validate(userId: string, args: ValidationArguments) {
          return (
            (args.object['userId'] && !args.object['appointmentId']) ||
            (!args.object['userId'] && args.object['appointmentId'])
          );
        },
      },
    });
  };
}

export function IsStringDate(options: ValidationOptions) {
  return (object, propertyName: string) => {
    registerDecorator({
      target: object.constructor,
      propertyName,
      options,
      validator: {
        validate(date) {
          return Date.parse(date) ? true : false;
        },
      },
    });
  };
}
