import {
  ICreateDispatch,
  IDeleteClientSettings,
  IDeleteDispatch,
  IInnerQueueTypes,
  IUpdateClientSettings,
  IUpdateSenderClientId,
  InnerQueueTypes,
} from '@argus/irisClient';
import {
  Environments,
  GlobalEventType,
  QueueType,
  ServiceName,
  formatEx,
  isOperationalEnv,
} from '@argus/pandora';
import { Injectable, NotImplementedException, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { HealthIndicator, HealthIndicatorResult } from '@nestjs/terminus';
import { SQS } from 'aws-sdk';
import { aws, containers, hosts } from 'config';
import { Consumer, SQSMessage } from 'sqs-consumer';
import { v4 } from 'uuid';
import { ConductorService } from '.';
import { LoggerService } from '../common';
import { ConfigsService, ExternalConfigs } from '../providers';

@Injectable()
export class QueueService extends HealthIndicator implements OnModuleInit, OnModuleDestroy {
  private readonly sqs = new SQS({
    region: aws.region,
    apiVersion: '2012-11-05',
    ...(isOperationalEnv() ? {} : { endpoint: hosts.localstack }),
  });
  private auditQueueUrl;
  private notificationsQueueUrl;
  private notificationsDLQUrl;
  private consumer: Consumer;

  constructor(
    private readonly conductorService: ConductorService,
    private readonly configsService: ConfigsService,
    private readonly logger: LoggerService,
  ) {
    super();
  }

  isHealthy(): HealthIndicatorResult {
    return {
      auditQueueUrl: { status: this.auditQueueUrl ? 'up' : 'down' },
      notificationsQueueUrl: { status: this.notificationsQueueUrl ? 'up' : 'down' },
      notificationsDLQUrl: { status: this.notificationsDLQUrl ? 'up' : 'down' },
    };
  }

  async onModuleInit(): Promise<void> {
    const { queueNameAudit, queueNameNotifications, queueNameNotificationsDLQ } =
      ExternalConfigs.aws;

    if (process.env.NODE_ENV === Environments.production) {
      const auditName = await this.configsService.getConfig(queueNameAudit);
      const { QueueUrl } = await this.sqs.getQueueUrl({ QueueName: auditName }).promise();
      this.auditQueueUrl = QueueUrl;
    }

    const queueName = await this.configsService.getEnvConfig({
      external: queueNameNotifications,
      local: aws.queue.notification,
    });
    const { QueueUrl: queueUrl } = await this.sqs.getQueueUrl({ QueueName: queueName }).promise();
    this.notificationsQueueUrl =
      process.env.NODE_ENV === Environments.localhost
        ? queueUrl.replace('localhost', containers.aws)
        : queueUrl;

    const dlQueueName = await this.configsService.getEnvConfig({
      external: queueNameNotificationsDLQ,
      local: aws.queue.notificationDLQ,
    });
    const { QueueUrl: dlQueueUrl } = await this.sqs
      .getQueueUrl({ QueueName: dlQueueName })
      .promise();
    this.notificationsDLQUrl =
      process.env.NODE_ENV === Environments.localhost
        ? dlQueueUrl.replace('localhost', containers.aws)
        : dlQueueUrl;

    // register and start consumer for NotificationQ
    this.consumer = Consumer.create({
      region: aws.region,
      queueUrl:
        process.env.NODE_ENV !== Environments.localhost
          ? queueUrl
          : queueUrl.replace('localhost', containers.aws),
      handleMessage: async (message) => {
        /**
         * we need to always catch exceptions coming from message, since if we don't, it'll
         * be stuck handling the message, and won't handle other messages.
         */
        try {
          await this.handleMessage(message);
        } catch (ex) {
          //TODO log this on slack
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

    this.logger.info(
      { queueConsumerRunning: this.consumer.isRunning },
      QueueService.name,
      this.onModuleInit.name,
    );
  }

  onModuleDestroy() {
    this.consumer?.stop();
  }

  async handleMessage(message: SQSMessage): Promise<void> {
    this.logger.info({ MessageId: message.MessageId }, QueueService.name, this.handleMessage.name);

    const body = message.Body;
    const object: IInnerQueueTypes = JSON.parse(body);
    switch (object.type) {
      case InnerQueueTypes.updateClientSettings:
        return this.conductorService.handleUpdateClientSettings(object as IUpdateClientSettings);
      case InnerQueueTypes.deleteClientSettings:
        return this.conductorService.handleDeleteClientSettings(object as IDeleteClientSettings);
      case InnerQueueTypes.updateSenderClientId:
        return this.conductorService.handleUpdateSenderClientId(object as IUpdateSenderClientId);
      case InnerQueueTypes.createDispatch:
        return this.conductorService.handleCreateDispatch(object as ICreateDispatch);
      case InnerQueueTypes.deleteDispatch:
        return this.conductorService.handleDeleteDispatch(object as IDeleteDispatch);
      default:
        throw new NotImplementedException();
    }
  }

  @OnEvent(GlobalEventType.notifyQueue, { async: true })
  async sendMessage(params: { type: QueueType; message: string }) {
    if (params.type === QueueType.audit && process.env.NODE_ENV !== Environments.production) {
      //audit log only exists in production
      this.logger.info(params, QueueService.name, this.sendMessage.name);
      return;
    }

    try {
      const { MessageId } = await this.sqs
        .sendMessage({
          MessageBody: params.message,
          MessageGroupId: ServiceName.iris,
          MessageDeduplicationId: v4(),
          QueueUrl: this.auditQueueUrl,
        })
        .promise();
      this.logger.info({ ...params, MessageId }, QueueService.name, this.sendMessage.name);
    } catch (ex) {
      this.logger.error(params, QueueService.name, this.sendMessage.name, ex);
    }
  }
}
