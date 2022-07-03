import {
  Environments,
  GlobalEventType,
  QueueType,
  ServiceName,
  StorageType,
  formatEx,
} from '@argus/pandora';
import { Injectable, NotImplementedException, OnModuleInit } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { SQS } from 'aws-sdk';
import { aws, containers, hosts } from 'config';
import { Consumer, SQSMessage } from 'sqs-consumer';
import { v4 } from 'uuid';
import { ConfigsService, ExternalConfigs, StorageService } from '.';
import { IEventNotifyQueue, LoggerService } from '../../common';

@Injectable()
export class QueueService implements OnModuleInit {
  private readonly sqs = new SQS({
    region: aws.region,
    apiVersion: '2012-11-05',
    ...(!process.env.NODE_ENV ||
    process.env.NODE_ENV === Environments.test ||
    process.env.NODE_ENV === Environments.localhost
      ? { endpoint: hosts.localstack }
      : {}),
  });
  private auditQueueUrl;
  private notificationsQueueUrl;
  private imageQueueUrl;
  private changeEventQueueUrl;
  private consumer;

  constructor(
    private readonly configsService: ConfigsService,
    private readonly logger: LoggerService,
    private readonly storageService: StorageService,
  ) {}

  async onModuleInit(): Promise<void> {
    const { queueNameAudit, queueNameNotifications, queueNameImage, queueNameChangeEvent } =
      ExternalConfigs.aws;

    if (process.env.NODE_ENV === Environments.production) {
      const auditName = await this.configsService.getConfig(queueNameAudit);
      const { QueueUrl } = await this.sqs.getQueueUrl({ QueueName: auditName }).promise();
      this.auditQueueUrl = QueueUrl;
    }

    const notificationsName =
      !process.env.NODE_ENV ||
      process.env.NODE_ENV === Environments.test ||
      process.env.NODE_ENV === Environments.localhost
        ? aws.queue.notification
        : await this.configsService.getConfig(queueNameNotifications);
    const { QueueUrl: notificationsQueueUrl } = await this.sqs
      .getQueueUrl({ QueueName: notificationsName })
      .promise();
    this.notificationsQueueUrl =
      process.env.NODE_ENV === Environments.localhost
        ? notificationsQueueUrl.replace('localhost', containers.aws)
        : notificationsQueueUrl;

    const imageName =
      !process.env.NODE_ENV ||
      process.env.NODE_ENV === Environments.test ||
      process.env.NODE_ENV === Environments.localhost
        ? aws.queue.image
        : await this.configsService.getConfig(queueNameImage);
    const { QueueUrl: imageQueueUrl } = await this.sqs
      .getQueueUrl({ QueueName: imageName })
      .promise();
    this.imageQueueUrl =
      process.env.NODE_ENV === Environments.localhost
        ? imageQueueUrl.replace('localhost', containers.aws)
        : imageQueueUrl;

    const changeEventName =
      !process.env.NODE_ENV ||
      process.env.NODE_ENV === Environments.test ||
      process.env.NODE_ENV === Environments.localhost
        ? aws.queue.changeEvent
        : await this.configsService.getConfig(queueNameChangeEvent);
    const { QueueUrl: changeEventsQueueUrl } = await this.sqs
      .getQueueUrl({ QueueName: changeEventName })
      .promise();
    this.changeEventQueueUrl =
      process.env.NODE_ENV === Environments.localhost
        ? changeEventsQueueUrl.replace('localhost', containers.aws)
        : changeEventsQueueUrl;

    // register and start consumer for ImageQ
    this.consumer = Consumer.create({
      region: aws.region,
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

  @OnEvent(GlobalEventType.notifyQueue, { async: true })
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
      case QueueType.changeEvent:
        return { QueueUrl: this.changeEventQueueUrl };
      default:
        throw new NotImplementedException();
    }
  }

  private async handleMessage(message: SQSMessage): Promise<void> {
    const normalImageKey = JSON.parse(message.Body).Records[0].s3.object.key;
    const memberId = normalImageKey.split('/')[2];
    const journalId = normalImageKey.split('/')[3].split('_')[0];
    const imageFormat = normalImageKey.split('/')[3].split('.')[1];

    await this.storageService.createJournalImageThumbnail(
      normalImageKey,
      `public/${StorageType.journals}/${memberId}/${journalId}_SmallImage.${imageFormat}`,
    );
  }
}
