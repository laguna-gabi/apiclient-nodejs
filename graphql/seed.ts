import { INestApplication, ValidationPipe } from '@nestjs/common';
import { GraphQLModule } from '@nestjs/graphql';
import { Test, TestingModule } from '@nestjs/testing';
import { createTestClient } from 'apollo-server-testing';
import { AppModule } from '../src/app.module';
import { Mutations } from '../test/integration/aux/mutations';
import { UserRole } from '../src/user';
import {
  generateAvailabilityInput,
  generateCreateMemberParams,
  generateCreateTaskParams,
  generateCreateUserParams,
  generateNotesParams,
  generateOrgParams,
  generateRequestAppointmentParams,
  generateScheduleAppointmentParams,
} from '../test';
import * as jwt from 'jsonwebtoken';
import * as faker from 'faker';
import { Identifier } from '../src/common';

/**
 * This is a seed file for initial local db creation.
 * The objects we're creating are:
 * 1. user(1) of type coach
 * 2. user(2) of type nurse
 * 3. user(3) of type coach and nurse
 * 4. organization
 * 5. member in organization above, having user(1) as his primaryCoach,
 *    and user(2), user(3) as his 2ndary users.
 * 6. appointments for member and his users.
 */

let mutations: Mutations;
let app: INestApplication;
type TaskType = 'goal' | 'actionItem';

async function main() {
  await init();

  console.debug(
    '\n----------------------------------------------------------------\n' +
      '----------------------- Creating 3 users -----------------------\n' +
      '----------------------------------------------------------------',
  );
  const { id: user1Id } = await createUser([UserRole.coach], 'user1');
  const { id: user2Id } = await createUser([UserRole.nurse], 'user2');
  const { id: user3Id } = await createUser([UserRole.coach, UserRole.nurse], 'user2');

  console.debug(
    '\n----------------------------------------------------------------\n' +
      '------------- Creating 9 availabilities for 3 users ------------\n' +
      '----------------------------------------------------------------',
  );
  await createAvailability(user1Id);
  await createAvailability(user2Id);
  await createAvailability(user3Id);

  console.debug(
    '\n----------------------------------------------------------------\n' +
      '------------------- Creating an organization -------------------\n' +
      '----------------------------------------------------------------',
  );
  const org = await mutations.createOrg({ orgParams: generateOrgParams() });
  console.log(`${org.id} : organization`);

  console.debug(
    '\n----------------------------------------------------------------\n' +
      '---------------------- Creating a member -----------------------\n' +
      '----------------------------------------------------------------',
  );
  const memberParams = generateCreateMemberParams({
    orgId: org.id,
    primaryCoachId: user1Id,
    usersIds: [user2Id, user3Id],
    email: faker.internet.email(),
    zipCode: faker.address.zipCode(),
    dischargeDate: faker.date.future(1),
  });

  const { id: memberId } = await mutations.createMember({
    memberParams,
  });
  console.log(
    `${memberId} : member with deviceId ${memberParams.deviceId}\nhaving a user1 ` +
      `as his primaryCoach, user2, user3 as his secondary users`,
  );

  const signed = jwt.sign({ username: memberParams.deviceId }, 'key-123');

  console.debug(
    `If you wish to call getMember this header should be added:\n` +
      `    "Authorization" : "Bearer ${signed}"\n` +
      `    like so : https://ibb.co/TmhMbDL [not a virus, don't worry]`,
  );

  console.debug(
    '\n----------------------------------------------------------------\n' +
      '-------- Scheduling appointments with users and member ---------\n' +
      '----------------------------------------------------------------',
  );
  await scheduleAppointment(memberId, user1Id, 'user1');
  await requestAppointment(memberId, user2Id, 'user2');
  const appointmentId = await scheduleAppointment(memberId, user2Id, 'user2');
  await setNotes(appointmentId);
  await scheduleAppointment(memberId, user3Id, 'user3');

  console.debug(
    '\n----------------------------------------------------------------\n' +
      '---------- Create goals and action items for a member ----------\n' +
      '----------------------------------------------------------------',
  );
  await createTask(memberId, mutations.createGoal, 'goal');
  await createTask(memberId, mutations.createGoal, 'goal');
  await createTask(memberId, mutations.createActionItem, 'actionItem');
  await createTask(memberId, mutations.createActionItem, 'actionItem');

  console.debug(
    '\n----------------------------------------------------------------\n' +
      '---------------- Pending sendbird registration -----------------\n' +
      '----------------------------------------------------------------',
  );
  //Since Sendbird is doing async calls in event emitter,
  //we need to wait a while for the actions to be finished.
  await new Promise((resolve) => setTimeout(resolve, 3000));

  await cleanUp();
}

/**************************************************************************************************
 **************************************** Internal methods ****************************************
 *************************************************************************************************/
const init = async () => {
  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  app = moduleFixture.createNestApplication();
  app.useGlobalPipes(new ValidationPipe());
  await app.init();

  const module: GraphQLModule = moduleFixture.get<GraphQLModule>(GraphQLModule);

  const apolloServer = createTestClient((module as any).apolloServer);
  mutations = new Mutations(apolloServer);
};

const cleanUp = async () => {
  /**
   * Since we have an eventEmitter updating db, we need to postpone closing the
   * db until after the update occurs.
   * @see [UserService#handleOrderCreatedEvent]
   */
  await new Promise((f) => setTimeout(f, 100));

  await app.close();
};

const createUser = async (roles: UserRole[], userText: string): Promise<Identifier> => {
  const { id } = await mutations.createUser({
    userParams: generateCreateUserParams({
      roles,
    }),
  });
  console.log(`${id} : ${userText} of type ${roles}`);

  return { id };
};

const createAvailability = async (userId: string) => {
  const availabilities = [
    generateAvailabilityInput({ userId }),
    generateAvailabilityInput({ userId }),
    generateAvailabilityInput({ userId }),
  ];
  await mutations.createAvailabilities({ availabilities });
};

const requestAppointment = async (memberId: string, userId: string, userText: string) => {
  const appointment = await mutations.requestAppointment({
    appointmentParams: generateRequestAppointmentParams({
      memberId,
      userId,
    }),
  });
  console.log(`${appointment.id} : request appointment for member and ${userText}`);
};

const scheduleAppointment = async (
  memberId: string,
  userId: string,
  userText: string,
): Promise<string> => {
  const appointment = await mutations.scheduleAppointment({
    appointmentParams: generateScheduleAppointmentParams({
      memberId,
      userId,
    }),
  });
  console.log(`${appointment.id} : scheduled appointment for member and ${userText}`);

  return appointment.id;
};

const setNotes = async (appointmentId: string) => {
  await mutations.setNotes({
    params: { appointmentId, ...generateNotesParams() },
  });
  console.log(`${appointmentId} : set notes and scores`);
};

const createTask = async (memberId: string, preformMethod, taskType: TaskType) => {
  const createTaskParams = generateCreateTaskParams({ memberId });
  const { id } = await preformMethod({ createTaskParams });
  console.log(`${id} : created a ${taskType} '${createTaskParams.title}' for member`);
};

(async () => {
  await main();
})();
