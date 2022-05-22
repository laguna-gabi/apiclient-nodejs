const { S3, SQS } = require('aws-sdk');
const { writeFileSync, readFileSync } = require('fs');

/** to have all the recordings transcribed we need to run this script to send all the recordings to Poseidon */

const limit = 0; // how many recordings to sent

const region = '';
const Bucket = ''; // s3 bucket name
const QueueName = ''; // transcript queue name

const fileName = './sentRecordings';

async function sendAllBucketRecordingsToPoseidon() {
  const s3 = new S3({ region, apiVersion: '2006-03-01', signatureVersion: 'v4' });
  const sqs = new SQS({ region, apiVersion: '2012-11-05' });

  const { QueueUrl } = await sqs.getQueueUrl({ QueueName }).promise();

  // get list of already sent recordings
  const sentRecordings = readFileSync(fileName);
  const sentRecordingsList = sentRecordings.toString().split(',');

  // get all recordings objects
  const { Contents } = await s3.listObjectsV2({ Bucket, Prefix: `public/recordings/` }).promise();
  const messageBodies = Contents.filter(
    (content) => content.Size > 0 && !sentRecordingsList.includes(content.Key),
  )
    .slice(0, limit)
    .map((content) => {
      sentRecordingsList.push(content.Key);
      return JSON.stringify({
        Records: [{ s3: { object: { key: content.Key, size: content.Size } } }],
      });
    });

  // send recordings to transcript queue
  await Promise.all(
    messageBodies.map(async (MessageBody) => {
      await sqs
        .sendMessage({
          MessageBody,
          QueueUrl,
        })
        .promise();
    }),
  );

  // save new list of sent recordings to file
  writeFileSync(fileName, sentRecordingsList.join(','));
}

sendAllBucketRecordingsToPoseidon();
