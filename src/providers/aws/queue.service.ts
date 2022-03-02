import { Environments, QueueType, ServiceName, formatEx } from '@lagunahealth/pandora';
import { Injectable, NotImplementedException, OnModuleInit } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import * as AWS from 'aws-sdk';
import * as config from 'config';
import { Consumer, SQSMessage } from 'sqs-consumer';
import { v4 } from 'uuid';
import { ConfigsService, ExternalConfigs, StorageService } from '.';
import { EventType, IEventNotifyQueue, LoggerService, StorageType } from '../../common';

@Injectable()
export class QueueService implements OnModuleInit {
  private readonly sqs = new AWS.SQS({
    region: config.get('aws.region'),
    apiVersion: '2012-11-05',
    ...(!process.env.NODE_ENV || process.env.NODE_ENV === Environments.test
      ? {
          endpoint: config.get('hosts.localstack'),
        }
      : {}),
  });
  private auditQueueUrl;
  private notificationsQueueUrl;
  private imageQueueUrl;
  private consumer;

  constructor(
    private readonly configsService: ConfigsService,
    private readonly logger: LoggerService,
    private readonly storageService: StorageService,
  ) {}

  async onModuleInit(): Promise<void> {
    const { queueNameAudit, queueNameNotifications, queueNameImage } = ExternalConfigs.aws;

    if (process.env.NODE_ENV === Environments.production) {
      const auditName = await this.configsService.getConfig(queueNameAudit);
      const { QueueUrl } = await this.sqs.getQueueUrl({ QueueName: auditName }).promise();
      this.auditQueueUrl = QueueUrl;
    }

    const notificationsName =
      !process.env.NODE_ENV || process.env.NODE_ENV === Environments.test
        ? config.get('aws.queue.notification')
        : await this.configsService.getConfig(queueNameNotifications);
    const { QueueUrl: notificationsQueueUrl } = await this.sqs
      .getQueueUrl({ QueueName: notificationsName })
      .promise();
    this.notificationsQueueUrl = notificationsQueueUrl;

    const imageName =
      !process.env.NODE_ENV || process.env.NODE_ENV === Environments.test
        ? config.get('aws.queue.image')
        : await this.configsService.getConfig(queueNameImage);
    const { QueueUrl: imageQueueUrl } = await this.sqs
      .getQueueUrl({ QueueName: imageName })
      .promise();
    this.imageQueueUrl = imageQueueUrl;

    // register and start consumer for ImageQ
    this.consumer = Consumer.create({
      region: config.get('aws.region'),
      queueUrl: this.imageQueueUrl,
      handleMessage: async (message) => {
        /**
         * we need to always catch exceptions coming from message, since if we don't, it'll
         * be stuck handling the message, and won't handle other messages.
         */
        try {
          await this.handleMessage(message);
        } catch (ex) {
          this.logger.error({}, QueueService.name, this.handleMessage.name, formatEx(ex));
        }
      },
    });

    this.consumer.on('error', (ex) => {
      this.logger.error({}, QueueService.name, this.handleMessage.name, formatEx(ex));
    });
    this.consumer.on('processing_error', (ex) => {
      this.logger.error({}, QueueService.name, this.handleMessage.name, formatEx(ex));
    });
    this.consumer.start();
  }

  @OnEvent(EventType.notifyQueue, { async: true })
  async sendMessage(params: IEventNotifyQueue) {
    if (params.type === QueueType.audit && process.env.NODE_ENV !== Environments.production) {
      //audit log only exists in production
      this.logger.info(params, QueueService.name, this.sendMessage.name);
      return;
    }

    try {
      const { MessageId } = await this.sqs
        .sendMessage({
          MessageBody: params.message,
          ...this.getQueueConfigs(params.type),
        })
        .promise();
      this.logger.info({ ...params, MessageId }, QueueService.name, this.sendMessage.name);
    } catch (ex) {
      this.logger.error(params, QueueService.name, this.sendMessage.name, formatEx(ex));
    }
  }

  getQueueConfigs(type: QueueType) {
    switch (type) {
      case QueueType.audit:
        return {
          MessageGroupId: ServiceName.hepius,
          MessageDeduplicationId: v4(),
          QueueUrl: this.auditQueueUrl,
        };
      case QueueType.notifications:
        return { QueueUrl: this.notificationsQueueUrl };
      default:
        throw new NotImplementedException();
    }
  }

  private async handleMessage(message: SQSMessage): Promise<void> {
    const normalImageKey = JSON.parse(message.Body).Records[0].s3.object.key;
    const memberId = normalImageKey.split('/')[2];
    const journalId = normalImageKey.split('/')[3].split('_')[0];
    const imageFormat = normalImageKey.split('/')[3].split('.')[1];
    // eslint-disable-next-line max-len
    const smallImageKey = `public/${StorageType.journals}/${memberId}/${journalId}_SmallImage.${imageFormat}`;

    await this.storageService.createJournalImageThumbnail(normalImageKey, smallImageKey);
  }
}
