import { Environments, formatEx } from '@argus/pandora';
import { Injectable, OnModuleInit } from '@nestjs/common';
import { SQS } from 'aws-sdk';
import { aws, hosts } from 'config';
import { Consumer, SQSMessage } from 'sqs-consumer';
import { ConfigsService, ExternalConfigs } from '.';
import { LoggerService } from '../../common';

@Injectable()
export class QueueService implements OnModuleInit {
  private readonly sqs = new SQS({
    region: aws.region,
    apiVersion: '2012-11-05',
    ...(!process.env.NODE_ENV || process.env.NODE_ENV === Environments.test
      ? { endpoint: hosts.localstack }
      : {}),
  });
  private changeEventQueueUrl;
  private consumer;

  constructor(
    private readonly configsService: ConfigsService,
    private readonly logger: LoggerService,
  ) {}

  async onModuleInit(): Promise<void> {
    const { queueNameChangeEvent } = ExternalConfigs.aws;

    const changeEventName =
      !process.env.NODE_ENV || process.env.NODE_ENV === Environments.test
        ? aws.queue.changeEvent
        : await this.configsService.getConfig(queueNameChangeEvent);
    const { QueueUrl: changeEventsQueueUrl } = await this.sqs
      .getQueueUrl({ QueueName: changeEventName })
      .promise();
    this.changeEventQueueUrl = changeEventsQueueUrl;

    // register and start consumer for TranscriptQ
    this.consumer = Consumer.create({
      region: aws.region,
      queueUrl: this.changeEventQueueUrl,
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

  private async handleMessage(message: SQSMessage): Promise<void> {
    console.log(message);
  }
}
