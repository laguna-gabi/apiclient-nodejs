import {
  BaseLogger,
  FailureReason,
  IEventNotifySlack,
  ServiceName,
  SlackChannel,
  SlackIcon,
} from '@lagunahealth/pandora';
import { Inject, Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PARAMS_PROVIDER_TOKEN, Params } from 'nestjs-pino';
import { EventType } from '.';

export const internalLogs = {
  hepiusVersion: `Starting ${ServiceName.hepius}  application version: @version@`,
  lastCommit: 'Last commit hash on this branch is: @hash@',
};

@Injectable()
export class LoggerService extends BaseLogger {
  private static VALID_KEYS = new Set([
    'id',
    'memberId',
    'userId',
    'orgId',
    'sub',
    // member
    'platform',
    'externalUserId',
    'deviceId',
    'hard',
    // member journal
    'normalImageKey',
    'smallImageKey',
    'imageFormat',
    'audioFormat',
    // member replace user
    'newUserId',
    'oldUserId',
    // member recordings
    'recordingIds',
    // appointment
    'updatedAppointmentAction',
    'notBefore',
    // availabilities
    'availabilities',
    // notes
    'scores',
    // to do
    'cronExpressions',
    'label',
    'createdBy',
    'updatedBy',
    // general
    'type',
    'start',
    'end',
    //sendbird
    'sendBirdChannelUrl',
    'senderUserId',
    'sender',
    'channel_url',
    'cover_url',
    'inviter_id',
    'user_ids',
    'user_id',
    //slack
    'channel',
    //general finish method time
    'finishedAndItTook',
    //queue
    'MessageId',
    //dispatches
    'dispatchId',
    'correlationId',
    'serviceName',
    'notificationType',
    'recipientClientId',
    'senderClientId',
    'appointmentTime',
    'appointmentId',
    'contentKey',
    'triggersAt',
    'path',
    'roles',
    //alerts
    'serviceName',
    'serviceNamespace',
    'clientSenderId',
    'questionnaireId',
    //care
    'status',
    'dueDate',
    'redFlagId',
    'barrierId',
    ...Object.keys(internalLogs),
  ]);

  constructor(
    @Inject(PARAMS_PROVIDER_TOKEN) params: Params,
    private readonly eventEmitter: EventEmitter2,
  ) {
    super(params, ServiceName.hepius, LoggerService.VALID_KEYS);
  }

  error(params = {}, className: string, methodName: string, failureReason?: FailureReason): void {
    const log = super.error(params, className, methodName, failureReason);

    const slackParams: IEventNotifySlack = {
      header: '*An error has occurred*',
      message: log || '',
      icon: SlackIcon.critical,
      channel: SlackChannel.notifications,
    };
    this.eventEmitter.emit(EventType.notifySlack, slackParams);
  }
}
