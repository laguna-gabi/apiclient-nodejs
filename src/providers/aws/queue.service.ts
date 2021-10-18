import { Injectable, OnModuleInit } from '@nestjs/common';
import * as AWS from 'aws-sdk';
import * as config from 'config';
import { ConfigsService, ExternalConfigs } from '.';
import {
  Environments,
  EventType,
  IEventQueueMessage,
  QueueType,
  SlackChannel,
  SlackIcon,
} from '../../common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';

@Injectable()
export class QueueService implements OnModuleInit {
  private readonly sqs = new AWS.SQS({
    region: config.get('providers.aws.region'),
    apiVersion: '2012-11-05',
  });
  private auditQueueUrl;

  constructor(
    private readonly configsService: ConfigsService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async onModuleInit(): Promise<void> {
    this.auditQueueUrl =
      process.env.NODE_ENV === Environments.production
        ? await this.configsService.getConfig(ExternalConfigs.aws.auditUrl)
        : undefined;
  }

  /**
   * audit log only exists in production
   */
  @OnEvent(EventType.queueMessage, { async: true })
  async sendMessage(params: IEventQueueMessage) {
    if (process.env.NODE_ENV === Environments.production) {
      try {
        await this.sqs
          .sendMessage({
            MessageBody: params.message,
            MessageGroupId: 'Hepius',
            QueueUrl: params.type === QueueType.audit ? this.auditQueueUrl : undefined,
          })
          .promise();
      } catch (ex) {
        this.eventEmitter.emit(EventType.slackMessage, {
          message: `failed to log audit message:\n${params.message}\n${ex}`,
          icon: SlackIcon.critical,
          channel: SlackChannel.notifications,
        });
      }
    }
  }
}
