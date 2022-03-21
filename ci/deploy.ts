process.env.AWS_REGION = 'us-east-1'; // set a global default AWS_REGION

import * as aws from 'aws-sdk';
import * as core from '@actions/core';
import { DescribeTaskDefinitionResponse } from 'aws-sdk/clients/ecs';
import { IncomingWebhook } from '@slack/webhook';
import { execSync } from 'child_process';
import { TaskDefinition } from 'aws-sdk/clients/ecs';

const DEFAULT_CLUSTER = `hepius`;

const WAIT_MINUTES = 30;
const WAIT_DEFAULT_DELAY_SEC = 15;

const DEVELOP_MAIN_BRANCH_NAME = 'develop';
const MASTER_MAIN_BRANCH_NAME = 'master';

const deployableBranches = [DEVELOP_MAIN_BRANCH_NAME, MASTER_MAIN_BRANCH_NAME];

// Attributes that are returned by DescribeTaskDefinition, but are not valid RegisterTaskDefinition inputs
const IGNORED_TASK_DEFINITION_ATTRIBUTES = [
  'compatibilities',
  'taskDefinitionArn',
  'requiresAttributes',
  'revision',
  'status',
  'registeredAt',
  'deregisteredAt',
  'registeredBy',
];

function logAndThrow(message: string) {
  core.error(message);
  throw new Error(message);
}

// Deploy to a service that uses the 'ECS' deployment controller
async function updateEcsService(
  ecs: aws.ECS,
  clusterName: string,
  service: string,
  taskDefArn: string,
  waitForService: boolean,
  waitForMinutes: number,
  forceNewDeployment: boolean,
) {
  await ecs
    .updateService({
      cluster: clusterName,
      service: service,
      taskDefinition: taskDefArn,
      forceNewDeployment: forceNewDeployment,
    })
    .promise();

  core.info(
    // eslint-disable-next-line max-len
    `Deployment started. Watch this deployment's progress in the Amazon ECS console: https://console.aws.amazon.com/ecs/home?region=${aws.config.region}#/clusters/${clusterName}/services/${service}/events`,
  );

  // Wait for service stability
  if (waitForService) {
    core.info(`Waiting for the service to become stable. Will wait for ${waitForMinutes} minutes`);
    const maxAttempts = (waitForMinutes * 60) / WAIT_DEFAULT_DELAY_SEC;
    await ecs
      .waitFor('servicesStable', {
        services: [service],
        cluster: clusterName,
        $waiter: {
          delay: WAIT_DEFAULT_DELAY_SEC,
          maxAttempts: maxAttempts,
        },
      })
      .promise();
  } else {
    core.info('Not waiting for the service to become stable');
  }
}

function removeIgnoredAttributes(taskDef) {
  for (const attribute of IGNORED_TASK_DEFINITION_ATTRIBUTES) {
    if (taskDef[attribute]) {
      core.debug(
        `Ignoring property '${attribute}' in the task definition file. ` +
          // eslint-disable-next-line max-len
          'This property is returned by the Amazon ECS DescribeTaskDefinition API and may be shown in the ECS console, ' +
          'but it is not a valid field when registering a new task definition. ' +
          'This field can be safely removed from your task definition file.',
      );
      delete taskDef[attribute];
    }
  }

  return taskDef;
}

function maintainValidObjects(taskDef) {
  if (validateProxyConfigurations(taskDef)) {
    taskDef.proxyConfiguration.properties.forEach((property, index, arr) => {
      if (!('value' in property)) {
        arr[index].value = '';
      }
      if (!('name' in property)) {
        arr[index].name = '';
      }
    });
  }

  if (taskDef && taskDef.containerDefinitions) {
    taskDef.containerDefinitions.forEach((container) => {
      if (container.environment) {
        container.environment.forEach((property, index, arr) => {
          if (!('value' in property)) {
            arr[index].value = '';
          }
        });
      }
    });
  }
  return taskDef;
}

function validateProxyConfigurations(taskDef) {
  return (
    'proxyConfiguration' in taskDef &&
    taskDef.proxyConfiguration.type &&
    taskDef.proxyConfiguration.type == 'APPMESH' &&
    taskDef.proxyConfiguration.properties &&
    taskDef.proxyConfiguration.properties.length > 0
  );
}

export async function deployTaskDefinition(
  awsClient: aws.ECS,
  taskDefinition: TaskDefinition,
  service: string,
  cluster: string,
  waitForService?: boolean,
) {
  try {
    const waitForMinutes = WAIT_MINUTES;

    const forceNewDeployment = false;

    const taskDefContents = maintainValidObjects(removeIgnoredAttributes(taskDefinition));

    let registerResponse;
    try {
      registerResponse = await awsClient.registerTaskDefinition(taskDefContents).promise();
    } catch (error) {
      core.error('Failed to register task definition in ECS: ' + error.message);
      core.info('Task definition contents:');
      core.info(JSON.stringify(taskDefContents, undefined, 4));
      throw error;
    }
    const taskDefArn = registerResponse.taskDefinition.taskDefinitionArn;

    // Update the service with the new task definition
    if (service) {
      const clusterName = cluster ? cluster : 'default';

      // Determine the deployment controller
      const describeResponse = await awsClient
        .describeServices({
          services: [service],
          cluster: clusterName,
        })
        .promise();

      if (describeResponse.failures && describeResponse.failures.length > 0) {
        const failure = describeResponse.failures[0];
        throw new Error(`${failure.arn} is ${failure.reason}`);
      }

      const serviceResponse = describeResponse.services[0];
      if (serviceResponse.status != 'ACTIVE') {
        throw new Error(`Service is ${serviceResponse.status}`);
      }

      if (!serviceResponse.deploymentController) {
        // Service uses the 'ECS' deployment controller, so we can call UpdateService
        await updateEcsService(
          awsClient,
          clusterName,
          service,
          taskDefArn,
          waitForService,
          waitForMinutes,
          forceNewDeployment,
        );
      } else {
        throw new Error(
          `Unsupported deployment controller: ${serviceResponse.deploymentController.type}`,
        );
      }
    } else {
      core.warning('Service was not specified, no service updated');
    }
  } catch (error) {
    throw new Error(
      `deployment of task definition (service: ${service}) failed. got: ${error.message}`,
    );
  }
}

// Description: read (describe) task definition, update a new image name and
// register a new (updated) task definition
const renderTaskDefinition = async (
  awsClient: aws.ECS,
  taskDefinition: string,
  imageName: string,
  appName: string,
): Promise<aws.ECS.TaskDefinition> => {
  const describeTaskResponse: DescribeTaskDefinitionResponse = await awsClient
    .describeTaskDefinition({
      taskDefinition,
    })
    .promise();

  const containerDef = describeTaskResponse?.taskDefinition?.containerDefinitions.find(
    (element) => element.name == `${appName}-${process.env.GITHUB_REF_NAME}-container`,
  );

  if (!containerDef) {
    throw new Error(
      'invalid task definition: Could not find container definition with matching name',
    );
  }
  containerDef.image = imageName;

  return describeTaskResponse.taskDefinition;
};

const sendSlackNotification = async (appName: string, slackChannelUrl: string) => {
  await new IncomingWebhook(slackChannelUrl).send({
    username: 'LagunaBot',
    icon_emoji: ':Gear:',
    channel: '#ci-cd',
    attachments: [
      {
        color: '#9733EE',
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              // eslint-disable-next-line max-len
              text: `*\`${appName}\` was deployed successfully to \`${process.env.CURRENT_BRANCH}\`.*\n*Last commit hash \`${process.env.GITHUB_SHA}\`*\nhttps://github.com/LagunaHealth/mono-be/actions/runs/${process.env.GITHUB_RUN_ID}`,
            },
          },
        ],
      },
    ],
  });
};

const deploy = async () => {
  const [, , appName, slackChannel] = process.argv;

  if (!appName || !slackChannel) {
    logAndThrow(`deploy failed - missing application name and slack channel url for notifications`);
  }

  if (
    !process.env.GITHUB_SHA ||
    !process.env.ECR_REGISTRY ||
    !process.env.GITHUB_RUN_ID ||
    process.env.GITHUB_REF_NAME
  ) {
    logAndThrow(`failed to deploy ${appName} - missing mandatory environment parameters`);
  }

  if (!deployableBranches.includes(process.env.GITHUB_REF_NAME)) {
    logAndThrow(
      `failed to deploy ${appName} - invalid branch ref name: ${process.env.GITHUB_REF_NAME}`,
    );
  }

  const nodeEnv = process.env.GITHUB_REF_NAME === 'develop' ? 'development' : 'production';

  const imageName = `${process.env.ECR_REGISTRY}/${appName}-${process.env.GITHUB_REF_NAME}`;
  const serviceName = `${appName}-${process.env.GITHUB_REF_NAME}-service`;
  const taskDefinitionName = `fargate-task-${appName}-${process.env.GITHUB_REF_NAME}`;
  const clusterName = `cluster-${DEFAULT_CLUSTER}-${process.env.GITHUB_REF_NAME}`;
  core.info(`\u001b[38;5;6mThis foreground will be cyan`);

  try {
    core.info(
      `\u001b[38;5;6mStart building image (${imageName}:${process.env.GITHUB_SHA}) for app ${appName}`,
    );
    execSync(
      `docker build -f ./apps/${appName}/Dockerfile -t ` +
        `${imageName}:${process.env.GITHUB_SHA} .` +
        ` --build-arg GIT_COMMIT=${process.env.GITHUB_SHA} --build-arg NODE_ENV=${nodeEnv}`,
    );

    core.info(`\u001b[38;5;6mTagging and pushing image to registry...`);
    execSync(`docker tag ${imageName}:${process.env.GITHUB_SHA} ${imageName}:latest`);
    execSync(`docker push ${imageName}:${process.env.GITHUB_SHA}`);
    execSync(`docker push ${imageName}:latest`);
  } catch (ex) {
    logAndThrow(`failed to build and push docker images for ${appName} application. got ${ex}`);
  }

  const awsClient = new aws.ECS({
    customUserAgent: 'amazon-ecs-deploy-task-definition-for-github-actions',
  });

  core.info(`\u001b[38;5;6mStart rendering task definition (name: ${taskDefinitionName})...`);
  let taskDefinition;
  try {
    taskDefinition = await renderTaskDefinition(awsClient, taskDefinitionName, imageName, appName);
  } catch (ex) {
    logAndThrow(`failed to render task definition. got: ${ex}`);
  }

  core.info(
    `\u001b[38;5;6mStart deploying task definition (name: ${taskDefinitionName}) for service (name: ${serviceName}) using cluster (name: ${clusterName})...`,
  );

  try {
    await deployTaskDefinition(awsClient, taskDefinition, serviceName, clusterName, true);
  } catch (ex) {
    logAndThrow(`failed to deploy task definition. got: ${ex}`);
  }

  // notify (per app) deployment
  await sendSlackNotification(appName, slackChannel);
};

deploy();
