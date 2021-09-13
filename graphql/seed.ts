import { INestApplication, ValidationPipe } from '@nestjs/common';
import { GraphQLModule } from '@nestjs/graphql';
import { Test, TestingModule } from '@nestjs/testing';
import { createTestClient } from 'apollo-server-testing';
import { AppModule } from '../src/app.module';
import { Mutations } from '../test/integration/aux/mutations';
import { Queries } from '../test/integration/aux/queries';
import { UserRole, UserService } from '../src/user';
import {
  generateAvailabilityInput,
  generateCreateMemberParams,
  generateCreateTaskParams,
  generateCreateUserParams,
  generateNotesParams,
  generateDateOnly,
  generateOrgParams,
  generateRequestAppointmentParams,
  generateScheduleAppointmentParams,
  generateSetGeneralNotesParams,
  delay,
  generateUpdateMemberParams,
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
let queries: Queries;
let userService: UserService; //used for internal method, isn't exposed on queries
let app: INestApplication;
type TaskType = 'goal' | 'actionItem';

async function main() {
  await init();

  const users = await userService.getRegisteredUsers();
  if (users.length === 0) {
    //No users existing in the db, creating one
    await createUser([UserRole.coach], 'user');
    //Since Sendbird is doing async calls in event emitter,
    //we need to wait a while for the actions to be finished since in createMember we're creating
    //a groupChannel that should wait for the user to be registered on sendbird.
    await delay(5000);
  }

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
    email: faker.internet.email(),
    zipCode: faker.address.zipCode(),
    dischargeDate: generateDateOnly(faker.date.future(1)),
  });

  const { id: memberId } = await mutations.createMember({
    memberParams,
  });
  const { primaryUserId } = await queries.getMember({ id: memberId });
  const updateMemberParams = generateUpdateMemberParams({ ...memberParams, id: primaryUserId });
  const member = await mutations.updateMember({ updateMemberParams });

  console.log(
    `${memberId} : member with deviceId ${member.deviceId}\nhaving` +
      ` primaryUser ${primaryUserId} was registered`,
  );

  console.debug(
    '\n----------------------------------------------------------------\n' +
      '---------------- Pending sendbird registration -----------------\n' +
      '----------------------------------------------------------------',
  );
  //Since Sendbird is doing async calls in event emitter,
  //we need to wait a while for the register of group chat to be finished.
  await delay(4000);

  const signed = jwt.sign({ username: member.deviceId }, 'key-123');

  console.debug(
    `If you wish to call getMember this header should be added:\n` +
      `    "Authorization" : "Bearer ${signed}"\n` +
      `    like so : https://ibb.co/TmhMbDL [not a virus, don't worry]`,
  );

  console.debug(
    '\n----------------------------------------------------------------\n' +
      '---------- Creating 3 availabilities for primaryUserId ---------\n' +
      '----------------------------------------------------------------',
  );
  await createAvailability(primaryUserId);

  console.debug(
    '\n----------------------------------------------------------------\n' +
      '-------- Scheduling appointments with users and member ---------\n' +
      '----------------------------------------------------------------',
  );
  await requestAppointment(memberId, primaryUserId);
  const appointmentId = await scheduleAppointment(memberId, primaryUserId);
  await delay(2000); //pending sendbird post events actions
  await endAppointment(appointmentId);
  await delay(2000); //pending sendbird post events actions
  await scheduleAppointment(memberId, primaryUserId);
  await delay(2000); //pending sendbird post events actions

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
      '---------------- Set general notes for a member ----------------\n' +
      '----------------------------------------------------------------',
  );
  await setGeneralNotes(memberId);

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
  queries = new Queries(apolloServer);

  userService = moduleFixture.get<UserService>(UserService);
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

const requestAppointment = async (memberId: string, userId: string) => {
  const appointment = await mutations.requestAppointment({
    appointmentParams: generateRequestAppointmentParams({
      memberId,
      userId,
    }),
  });
  console.log(`${appointment.id} : request appointment for member and primaryUser`);
};

const scheduleAppointment = async (memberId: string, userId: string): Promise<string> => {
  const appointment = await mutations.scheduleAppointment({
    appointmentParams: generateScheduleAppointmentParams({
      memberId,
      userId,
    }),
  });
  console.log(`${appointment.id} : scheduled appointment for member and primaryUser`);

  return appointment.id;
};

const endAppointment = async (id: string) => {
  await mutations.endAppointment({
    endAppointmentParams: { id, notes: generateNotesParams() },
  });
  console.log(`${id} : end appointment with notes and scores`);
};

const setGeneralNotes = async (memberId: string) => {
  const setGeneralNotesParams = generateSetGeneralNotesParams({ memberId });
  await mutations.setGeneralNotes({ setGeneralNotesParams });
};

const createTask = async (memberId: string, preformMethod, taskType: TaskType) => {
  const createTaskParams = generateCreateTaskParams({ memberId });
  const { id } = await preformMethod({ createTaskParams });
  console.log(`${id} : created a ${taskType} '${createTaskParams.title}' for member`);
};

(async () => {
  await main();
})();
