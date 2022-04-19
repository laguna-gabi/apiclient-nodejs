import { S3 } from 'aws-sdk';
import { readFileSync } from 'fs';

const COVERAGE_BUCKET = 'laguna-health-coverage';
const FILES_TO_UPLOAD = [
  'badge-branches.svg',
  'badge-functions.svg',
  'badge-lines.svg',
  'badge-statements.svg',
  'coverage-summary.json',
];

const s3 = new S3({ signatureVersion: 'v4', apiVersion: '2006-03-01', region: 'us-east-1' });

const uploadCoverage = async () => {
  const [, , appName, path] = process.argv;

  var params = {
    Bucket: COVERAGE_BUCKET,
    Prefix: `${appName}/`,
  };

  const files = await s3.listObjects(params).promise();
  if (files.Contents.length > 0) {
    const deleteParams = { Bucket: COVERAGE_BUCKET, Delete: { Objects: [] } };

    files.Contents.forEach(function (content) {
      deleteParams.Delete.Objects.push({ Key: content.Key });
    });

    await s3.deleteObjects(deleteParams).promise();
  }

  FILES_TO_UPLOAD.map(async (fileName) => {
    const fileContent = readFileSync(`${path}${fileName}`);

    const params = {
      Bucket: COVERAGE_BUCKET,
      Key: `${appName}/${fileName}`,
      Body: fileContent,
    };

    await s3.upload(params).promise();
  });
};

uploadCoverage();
