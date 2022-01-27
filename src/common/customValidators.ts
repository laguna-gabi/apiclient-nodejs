import { CancelNotificationType, NotificationType, Platform } from '@lagunahealth/pandora';
import { ValidationArguments, ValidationOptions, registerDecorator } from 'class-validator';
import { general } from 'config';
import { isValidCron } from 'cron-validator';
import { differenceInMilliseconds } from 'date-fns';
import { isNil } from 'lodash';
import { Types as MongooseTypes } from 'mongoose';
import { lookup } from 'zipcode-to-timezone';

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

export function IsDateInNotificationRange(options?: ValidationOptions) {
  return (object, propertyName: string) => {
    registerDecorator({
      target: object.constructor,
      propertyName,
      options,
      validator: {
        validate(date?: Date) {
          return (
            differenceInMilliseconds(date?.getTime(), new Date().getTime()) <=
            general.notificationRange * 24 * 60 * 60 * 1000
          );
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
          return noShow ? true : !reason;
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
          return !!Date.parse(date);
        },
      },
    });
  };
}

export function IsValidZipCode(options: ValidationOptions) {
  return (object, propertyName: string) => {
    registerDecorator({
      target: object.constructor,
      propertyName,
      options,
      validator: {
        validate(zipCode) {
          return lookup(zipCode);
        },
      },
    });
  };
}

export function IsTypeMetadataProvided(options: ValidationOptions) {
  return (object, propertyName: string) => {
    registerDecorator({
      target: object.constructor,
      propertyName,
      options,
      validator: {
        validate(type: string, args: ValidationArguments) {
          const whenNotInMetadata = !('when' in args.object['metadata']);
          switch (type) {
            case NotificationType.call:
            case NotificationType.video:
            case CancelNotificationType.cancelCall:
            case CancelNotificationType.cancelVideo: {
              return 'peerId' in args.object['metadata'] && whenNotInMetadata;
            }
            case NotificationType.text:
            case NotificationType.textSms: {
              return 'content' in args.object['metadata'];
            }
            case CancelNotificationType.cancelText: {
              return whenNotInMetadata;
            }
          }
        },
      },
    });
  };
}

export function IsNotChat(options: ValidationOptions) {
  return (object, propertyName: string) => {
    registerDecorator({
      target: object.constructor,
      propertyName,
      options,
      validator: {
        validate(notificationType: NotificationType) {
          return notificationType !== NotificationType.chat;
        },
      },
    });
  };
}

export function IsNotPlatformWeb(options: ValidationOptions) {
  return (object, propertyName: string) => {
    registerDecorator({
      target: object.constructor,
      propertyName,
      options,
      validator: {
        validate(platform: Platform) {
          return platform !== Platform.web;
        },
      },
    });
  };
}

export function IsObjectId(options?: ValidationOptions) {
  return (object, propertyName: string) => {
    registerDecorator({
      name: 'isObjectId',
      target: object.constructor,
      propertyName,
      options,
      validator: {
        validate(value: any) {
          return MongooseTypes.ObjectId.isValid(value) || value == undefined;
        },
      },
    });
  };
}

export function IsNoteOrNurseNoteProvided(options?: ValidationOptions) {
  return (object, propertyName: string) => {
    registerDecorator({
      target: object.constructor,
      propertyName,
      options,
      validator: {
        validate(object, args: ValidationArguments) {
          return !isNil(args.object['note']) || !isNil(args.object['nurseNotes']);
        },
      },
    });
  };
}

export function IsCronExpression(options: ValidationOptions) {
  return (object, propertyName: string) => {
    registerDecorator({
      target: object.constructor,
      propertyName,
      options,
      validator: {
        validate(cronExpressions: string[]) {
          return cronExpressions
            ? cronExpressions.every((cronExpression) => isValidCron(cronExpression))
            : true;
        },
      },
    });
  };
}

export function IsUnscheduledTodo(options: ValidationOptions) {
  return (object, propertyName: string) => {
    registerDecorator({
      target: object.constructor,
      propertyName,
      options,
      validator: {
        validate(value, args: ValidationArguments) {
          const cronExpressions = args.object['cronExpressions'];
          const start = args.object['start'];
          const end = args.object['end'];
          if (!cronExpressions && !start && !end) {
            return true;
          } else if (cronExpressions && start) {
            return true;
          } else {
            return false;
          }
        },
      },
    });
  };
}

export function IsCustomOrSuggestedCarePlan(options: ValidationOptions) {
  return (object, propertyName: string) => {
    registerDecorator({
      target: object.constructor,
      propertyName,
      options,
      validator: {
        validate(carePlanType: string, args: ValidationArguments) {
          return Boolean(args.object['carePlanType']) == Boolean(args.object['appointmentId']);
        },
      },
    });
  };
}
