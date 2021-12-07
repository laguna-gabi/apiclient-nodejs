import { Injectable, NotImplementedException, OnModuleInit } from '@nestjs/common';
import * as AWS from 'aws-sdk';
import * as config from 'config';
import { ConfigsService, ExternalConfigs } from '.';
import { Environments, EventType, IEventNotifyQueue, Logger, QueueType } from '../../common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { v4 } from 'uuid';

@Injectable()
export class QueueService implements OnModuleInit {
  private readonly sqs = new AWS.SQS({
    region: config.get('aws.region'),
    apiVersion: '2012-11-05',
  });
  private auditQueueUrl;
  private notificationsQueueUrl;

  constructor(
    private readonly configsService: ConfigsService,
    private readonly eventEmitter: EventEmitter2,
    private readonly logger: Logger,
  ) {}

  async onModuleInit(): Promise<void> {
    const { queueNameAudit, queueNameNotifications } = ExternalConfigs.aws;

    if (process.env.NODE_ENV === Environments.production) {
      const auditName = await this.configsService.getConfig(queueNameAudit);
      const { QueueUrl } = await this.sqs.getQueueUrl({ QueueName: auditName }).promise();
      this.auditQueueUrl = QueueUrl;
    }

    const notificationsName = await this.configsService.getConfig(queueNameNotifications);
    const { QueueUrl } = await this.sqs.getQueueUrl({ QueueName: notificationsName }).promise();
    this.notificationsQueueUrl = QueueUrl;
  }

  @OnEvent(EventType.notifyQueue, { async: true })
  async sendMessage(params: IEventNotifyQueue) {
    if (params.type === QueueType.audit && process.env.NODE_ENV !== Environments.production) {
      //audit log only exists in production
      this.logger.debug(params, QueueService.name, this.sendMessage.name);
      return;
    }

    try {
      await this.sqs
        .sendMessage({
          MessageBody: params.message,
          ...this.getQueueConfigs(params.type),
        })
        .promise();
    } catch (ex) {
      this.logger.error(params, QueueService.name, this.sendMessage.name, ex);
    }
  }

  getQueueConfigs(type: QueueType) {
    switch (type) {
      case QueueType.audit:
        return {
          MessageGroupId: 'Hepius',
          MessageDeduplicationId: v4(),
          QueueUrl: this.auditQueueUrl,
        };
      case QueueType.notifications:
        return { QueueUrl: this.notificationsQueueUrl };
      default:
        throw new NotImplementedException();
    }
  }
}
