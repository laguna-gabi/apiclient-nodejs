import {
  ICreateDispatch,
  IDeleteDispatch,
  IInnerQueueTypes,
  IUpdateClientSettings,
  InnerQueueTypes,
} from '@lagunahealth/pandora';
import { Injectable, NotImplementedException, OnModuleInit } from '@nestjs/common';
import * as AWS from 'aws-sdk';
import * as config from 'config';
import { Consumer, SQSMessage } from 'sqs-consumer';
import { ConfigsService, ExternalConfigs } from '../providers';
import { Logger } from '../common';
import { ConductorService } from '.';

@Injectable()
export class QueueService implements OnModuleInit {
  private readonly sqs = new AWS.SQS({
    region: config.get('aws.region'),
    apiVersion: '2012-11-05',
  });
  private notificationsQ;
  private notificationsDLQ;

  constructor(
    private readonly conductorService: ConductorService,
    private readonly configsService: ConfigsService,
    private readonly logger: Logger,
  ) {}

  async onModuleInit(): Promise<void> {
    const { queueNameNotifications, queueNameNotificationsDLQ } = ExternalConfigs.aws;

    // fetch 2 queues
    const queueName = await this.configsService.getConfig(queueNameNotifications);
    const { QueueUrl: queueUrl } = await this.sqs.getQueueUrl({ QueueName: queueName }).promise();
    this.notificationsQ = queueUrl;

    const dlQueueName = await this.configsService.getConfig(queueNameNotificationsDLQ);
    const { QueueUrl: dlQueueUrl } = await this.sqs
      .getQueueUrl({ QueueName: dlQueueName })
      .promise();
    this.notificationsDLQ = dlQueueUrl;

    // register and start consumer for NotificationQ
    const consumer = Consumer.create({
      queueUrl,
      handleMessage: async (message) => await this.handleMessage(message),
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
      case InnerQueueTypes.createDispatch:
        return this.conductorService.handleCreateDispatch(object as ICreateDispatch);
      case InnerQueueTypes.deleteDispatch:
        return this.conductorService.handleDeleteDispatch(object as IDeleteDispatch);
      default:
        throw new NotImplementedException();
    }
  }
}
