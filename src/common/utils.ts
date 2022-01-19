import {
  CancelNotificationType,
  ContentKey,
  ExternalKey,
  InternalKey,
  NotificationType,
} from '@lagunahealth/pandora';
import { format } from 'date-fns';
import * as jwt from 'jsonwebtoken';
import { v4 } from 'uuid';
import { LoggerService } from '.';

export function reformatDate(date: string, stringFormat: string): string {
  const dateObject = Date.parse(date);

  if (dateObject) {
    return format(dateObject, stringFormat);
  }
}

export function capitalize(content: string): string {
  return content[0].toUpperCase() + content.slice(1);
}

type SetObject = {
  [key: string]: string;
};

// Description: extract a custom set object for mongo embedded objects
export function extractEmbeddedSetObject(object, prop: string): SetObject {
  const update: SetObject = {};
  for (const key in object[prop]) {
    if (object[prop][key] !== undefined) {
      update[`${prop}.${key}`] = object[prop][key];
    }
  }

  return update;
}

export const extractAuthorizationHeader = (context) => {
  const authorizationHeader = context.req?.headers?.authorization?.replace('Bearer ', '');
  return jwt.decode(authorizationHeader);
};

export const delay = async (milliseconds: number) => {
  await new Promise((resolve) => setTimeout(resolve, milliseconds));
};

export const isGQLResultValid = ({
  result,
  invalidFieldsErrors,
  missingFieldError = undefined,
}): boolean => {
  if (invalidFieldsErrors) {
    for (let i = 0; i < invalidFieldsErrors.length; i++) {
      expect(invalidFieldsErrors[i]).toEqual(
        result.errors[0][i]?.message || result.errors[0]?.message,
      );
      expect(result.errors[0][i]?.code || result.errors[0]?.code).not.toEqual(-1);
    }
  } else if (missingFieldError) {
    expect(result.errors[0].message || result.errors[0][0].message).toMatch(missingFieldError);
    expect(result.errors[0].code || result.errors[0][0].code).toEqual(-1);
  } else {
    return true;
  }

  return false;
};

export const getCorrelationId = (logger: LoggerService) =>
  logger?.logger?.bindings?.().reqId || v4();

export const generatePath = (
  type: NotificationType | CancelNotificationType,
  contentKey?: ContentKey,
  ...params: string[]
) => {
  if (type === NotificationType.call || type === NotificationType.video) {
    return 'call';
  }

  switch (contentKey) {
    case InternalKey.appointmentRequest:
    case InternalKey.newChatMessageFromUser:
      return `connect/${params.join('/')}`;
    case ExternalKey.addCaregiverDetails:
      return 'settings/carecircle';
    case ExternalKey.setCallPermissions:
      return 'settings/callpermissions';
  }
};
