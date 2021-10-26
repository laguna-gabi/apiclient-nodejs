import { Injectable, OnModuleInit } from '@nestjs/common';
import * as AWS from 'aws-sdk';
import * as config from 'config';
import { ConfigsService, ExternalConfigs } from '.';
import { Environments, EventType, IEventQueueMessage, Logger, QueueType } from '../../common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';

@Injectable()
export class QueueService implements OnModuleInit {
  private readonly sqs = new AWS.SQS({
    region: config.get('aws.region'),
    apiVersion: '2012-11-05',
  });
  private auditQueueUrl;

  constructor(
    private readonly configsService: ConfigsService,
    private readonly eventEmitter: EventEmitter2,
    private readonly logger: Logger,
  ) {}

  async onModuleInit(): Promise<void> {
    if (process.env.NODE_ENV === Environments.production) {
      const queueNameAudit = await this.configsService.getConfig(
        ExternalConfigs.aws.queueNameAudit,
      );
      const { QueueUrl } = await this.sqs.getQueueUrl({ QueueName: queueNameAudit }).promise();
      this.auditQueueUrl = QueueUrl;
    }
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
        this.logger.error(params, QueueService.name, this.sendMessage.name, ex);
      }
    } else if (process.env.NODE_ENV === Environments.development) {
      this.logger.debug(params, QueueService.name, this.sendMessage.name);
    }
  }
}
