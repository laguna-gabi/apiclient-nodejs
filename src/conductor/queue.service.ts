import {
  ICreateDispatch,
  IDeleteClientSettings,
  IDeleteDispatch,
  IInnerQueueTypes,
  IUpdateClientSettings,
  InnerQueueTypes,
} from '@lagunahealth/pandora';
import { Injectable, NotImplementedException, OnModuleInit } from '@nestjs/common';
import { HealthIndicator, HealthIndicatorResult } from '@nestjs/terminus';
import * as AWS from 'aws-sdk';
import * as config from 'config';
import { Consumer, SQSMessage } from 'sqs-consumer';
import { ConfigsService, ExternalConfigs } from '../providers';
import { Environments, Logger } from '../common';
import { ConductorService } from '.';

@Injectable()
export class QueueService extends HealthIndicator implements OnModuleInit {
  private readonly sqs = new AWS.SQS({
    region: config.get('aws.region'),
    apiVersion: '2012-11-05',
    ...(!process.env.NODE_ENV ||
    process.env.NODE_ENV === Environments.test ||
    process.env.NODE_ENV === Environments.localhost
      ? {
          endpoint: 'http://localhost:4566',
        }
      : {}),
  });
  private notificationsQ;
  private notificationsDLQ;

  constructor(
    private readonly conductorService: ConductorService,
    private readonly configsService: ConfigsService,
    private readonly logger: Logger,
  ) {
    super();
  }

  isHealthy(): HealthIndicatorResult {
    return {
      notificationsQ: { status: this.notificationsQ ? 'up' : 'down' },
      notificationsDLQ: { status: this.notificationsDLQ ? 'up' : 'down' },
    };
  }

  async onModuleInit(): Promise<void> {
    const { queueNameNotifications, queueNameNotificationsDLQ } = ExternalConfigs.aws;

    const queueName =
      !process.env.NODE_ENV ||
      process.env.NODE_ENV === Environments.test ||
      process.env.NODE_ENV === Environments.localhost
        ? config.get('aws.queue.notification')
        : await this.configsService.getConfig(queueNameNotifications);
    const { QueueUrl: queueUrl } = await this.sqs.getQueueUrl({ QueueName: queueName }).promise();
    this.notificationsQ = queueUrl;

    const dlQueueName =
      !process.env.NODE_ENV ||
      process.env.NODE_ENV === Environments.test ||
      process.env.NODE_ENV === Environments.localhost
        ? config.get('aws.queue.notificationDLQ')
        : await this.configsService.getConfig(queueNameNotificationsDLQ);
    const { QueueUrl: dlQueueUrl } = await this.sqs
      .getQueueUrl({ QueueName: dlQueueName })
      .promise();
    this.notificationsDLQ = dlQueueUrl;

    // register and start consumer for NotificationQ
    const consumer = Consumer.create({
      region: config.get('aws.region'),
      queueUrl,
      handleMessage: async (message) => {
        /**
         * we need to always catch exceptions coming from message, since if we don't, it'll
         * be stuck handling the message, and won't handle other messages.
         */
        try {
          await this.handleMessage(message);
        } catch (ex) {
          //TODO log this on slack and logger.error
          console.error(ex);
        }
      },
    });

    consumer.on('error', (err) => {
      console.error(err.message);
    });
    consumer.on('processing_error', (err) => {
      console.error(err.message);
    });
    consumer.start();

    this.logger.debug(
      { queueConsumerRunning: consumer.isRunning ? true : false },
      QueueService.name,
      this.onModuleInit.name,
    );
  }

  async handleMessage(message: SQSMessage): Promise<void> {
    this.logger.debug({ MessageId: message.MessageId }, QueueService.name, this.handleMessage.name);

    const body = message.Body;
    const object: IInnerQueueTypes = JSON.parse(body);
    switch (object.type) {
      case InnerQueueTypes.updateClientSettings:
        return this.conductorService.handleUpdateClientSettings(object as IUpdateClientSettings);
      case InnerQueueTypes.deleteClientSettings:
        return this.conductorService.handleDeleteClientSettings(object as IDeleteClientSettings);
      case InnerQueueTypes.createDispatch:
        return this.conductorService.handleCreateDispatch(object as ICreateDispatch);
      case InnerQueueTypes.deleteDispatch:
        return this.conductorService.handleDeleteDispatch(object as IDeleteDispatch);
      default:
        throw new NotImplementedException();
    }
  }
}
