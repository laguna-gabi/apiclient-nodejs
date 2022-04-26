import { Environments, EventType, QueueType, ServiceName, formatEx } from '@argus/pandora';
import { Injectable, OnModuleInit } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { SQS } from 'aws-sdk';
import { aws, hosts } from 'config';
import { Consumer, SQSMessage } from 'sqs-consumer';
import { v4 } from 'uuid';
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
  private auditQueueUrl;
  private transcriptQueueUrl;
  private consumer;

  constructor(
    private readonly configsService: ConfigsService,
    private readonly logger: LoggerService,
  ) {}

  async onModuleInit(): Promise<void> {
    const { queueNameAudit, queueNameTranscript } = ExternalConfigs.aws;

    if (process.env.NODE_ENV === Environments.production) {
      const auditName = await this.configsService.getConfig(queueNameAudit);
      const { QueueUrl } = await this.sqs.getQueueUrl({ QueueName: auditName }).promise();
      this.auditQueueUrl = QueueUrl;
    }

    const transcriptName =
      !process.env.NODE_ENV || process.env.NODE_ENV === Environments.test
        ? aws.queue.transcript
        : await this.configsService.getConfig(queueNameTranscript);
    const { QueueUrl } = await this.sqs.getQueueUrl({ QueueName: transcriptName }).promise();
    this.transcriptQueueUrl = QueueUrl;

    // register and start consumer for TranscriptQ
    this.consumer = Consumer.create({
      region: aws.region,
      queueUrl: this.transcriptQueueUrl,
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
          MessageGroupId: ServiceName.poseidon,
          MessageDeduplicationId: v4(),
          QueueUrl: this.auditQueueUrl,
        })
        .promise();
      this.logger.info({ ...params, MessageId }, QueueService.name, this.sendMessage.name);
    } catch (ex) {
      this.logger.error(params, QueueService.name, this.sendMessage.name, ex);
    }
  }

  private async handleMessage(message: SQSMessage): Promise<void> {
    console.log(message);
  }
}
