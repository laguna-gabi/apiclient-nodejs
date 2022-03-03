import {
  AppointmentInternalKey,
  CancelNotificationType,
  ChatInternalKey,
  ContentKey,
  ExternalKey,
  NotificationType,
  TodoInternalKey,
  formatEx,
} from '@lagunahealth/pandora';
import { format } from 'date-fns';
import * as jwt from 'jsonwebtoken';
import { Model, Types } from 'mongoose';
import { ISoftDelete } from '../db';
import { v4 } from 'uuid';
import { IEventDeleteMember, LoggerService } from '.';
import { CaregiverDocument, JournalDocument, RecordingDocument } from '../member';
import { TodoDocument, TodoDoneDocument } from '../todo';
import { DailyReportDocument } from '../dailyReport';
import { QuestionnaireResponseDocument } from '../questionnaire';
import { BarrierDocument, CarePlanDocument, RedFlagDocument } from '../care';
import { graphql } from 'config';

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
    case AppointmentInternalKey.appointmentRequest:
    case ChatInternalKey.newChatMessageFromUser:
      return `connect/${params.join('/')}`;
    case ExternalKey.addCaregiverDetails:
      return 'settings/carecircle';
    case ExternalKey.setCallPermissions:
      return 'settings/callpermissions';
  }

  if (Object.values(TodoInternalKey).find((key) => key === contentKey)) {
    return 'todo';
  }
};

type Entity =
  | CaregiverDocument
  | RecordingDocument
  | JournalDocument
  | TodoDocument
  | TodoDoneDocument
  | DailyReportDocument
  | QuestionnaireResponseDocument
  | RedFlagDocument
  | BarrierDocument
  | CarePlanDocument;

export async function deleteMemberObjects<T extends Model<Entity> & ISoftDelete<Entity>>(
  params: IEventDeleteMember,
  model: T,
  logger: LoggerService,
  methodName: string,
  serviceName: string,
) {
  logger.info(params, serviceName, methodName);

  try {
    const { memberId, hard, deletedBy } = params;
    const objects = await model.findWithDeleted({
      memberId: new Types.ObjectId(memberId),
    });
    if (!objects) return;

    if (hard) {
      await model.deleteMany({ memberId: new Types.ObjectId(memberId) });
    } else {
      await Promise.all(
        objects.map(async (object) => {
          await object.delete(new Types.ObjectId(deletedBy));
        }),
      );
    }
  } catch (ex) {
    logger.error(params, serviceName, methodName, formatEx(ex));
  }
}

export type defaultTimestampsDbValues = { createdAt: Date; updatedAt: Date };

export type defaultAuditDbValues = { createdBy: Types.ObjectId; updatedBy: Types.ObjectId };

export const minLength = graphql.validators.name.minLength as number;
export const maxLength = graphql.validators.name.maxLength as number;
