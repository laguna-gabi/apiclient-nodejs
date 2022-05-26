import {
  BaseLogger,
  FailureReason,
  GlobalEventType,
  IEventNotifySlack,
  ServiceName,
  SlackChannel,
  SlackIcon,
} from '@argus/pandora';
import { Inject, Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PARAMS_PROVIDER_TOKEN, Params } from 'nestjs-pino';

@Injectable()
export class LoggerService extends BaseLogger {
  private static validKeys = new Set([
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
    'concent',
    'identityVerification',
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
    'orgName',
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
  ]);

  constructor(
    @Inject(PARAMS_PROVIDER_TOKEN) params: Params,
    private readonly eventEmitter: EventEmitter2,
  ) {
    super(params, ServiceName.hepius, LoggerService.validKeys);
  }

  error(params = {}, className: string, methodName: string, failureReason?: FailureReason): void {
    const log = super.error(params, className, methodName, failureReason);

    const slackParams: IEventNotifySlack = {
      header: '*An error has occurred*',
      message: log || '',
      icon: SlackIcon.critical,
      channel: SlackChannel.notifications,
    };
    this.eventEmitter.emit(GlobalEventType.notifySlack, slackParams);
  }
}
