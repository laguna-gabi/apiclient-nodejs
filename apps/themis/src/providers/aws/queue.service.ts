import { IChangeEvent, formatEx, isOperationalEnv } from '@argus/pandora';
import { Injectable, NotAcceptableException, OnModuleInit } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { HealthIndicatorResult } from '@nestjs/terminus';
import { SQS } from 'aws-sdk';
import { aws, hosts } from 'config';
import { Consumer, SQSMessage } from 'sqs-consumer';
import { ConfigsService, ExternalConfigs } from '.';
import { EventType, LoggerService } from '../../common';
import { Types } from 'mongoose';

@Injectable()
export class QueueService implements OnModuleInit {
  private readonly sqs = new SQS({
    region: aws.region,
    apiVersion: '2012-11-05',
    ...(isOperationalEnv() ? {} : { endpoint: hosts.localstack }),
  });
  private changeEventQueueUrl;
  private consumer;

  constructor(
    private readonly configsService: ConfigsService,
    private readonly logger: LoggerService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async onModuleInit(): Promise<void> {
    const changeEventName = await this.configsService.getEnvConfig({
      external: ExternalConfigs.aws.queueNameChangeEvent,
      local: aws.queue.changeEvent,
    });
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

  isHealthy(): HealthIndicatorResult {
    return {
      changeEventQueueUrl: { status: this.changeEventQueueUrl ? 'up' : 'down' },
    };
  }

  async handleMessage(message: SQSMessage): Promise<void> {
    this.logger.info({ MessageId: message.MessageId }, QueueService.name, this.handleMessage.name);

    const changeEvent: IChangeEvent = JSON.parse(message.Body);

    if (!Types.ObjectId.isValid(changeEvent.memberId)) {
      throw new NotAcceptableException();
    }

    await this.eventEmitter.emitAsync(EventType.onChangeEvent, changeEvent);
  }
}
