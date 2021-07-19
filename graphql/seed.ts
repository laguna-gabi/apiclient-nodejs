import { INestApplication, ValidationPipe } from '@nestjs/common';
import { GraphQLModule } from '@nestjs/graphql';
import { Test, TestingModule } from '@nestjs/testing';
import { createTestClient } from 'apollo-server-testing';
import { AppModule } from '../src/app.module';
import { Mutations } from '../test/integration/mutations';
import { UserRole } from '../src/user';
import {
  generateCreateMemberParams,
  generateCreateUserParams,
  generateRequestAppointmentParams,
  generateScheduleAppointmentParams,
} from '../test';

/**
 * This is a seed file for initial local db creation.
 * The objects we're creating are:
 * 1. user(1) of type coach
 * 2. user(2) of type nurse
 * 3. user(3) of type coach and nurse
 * 4. member having user(1) as his primaryCoach, and user(2), user(3) as his 2ndary users.
 * 5. appointments for member and his users.
 */

let mutations: Mutations;
let app: INestApplication;

async function main() {
  await init();

  console.debug(
    '\n----------------------------------------------------------------\n' +
      '----------------------- Creating 3 users -----------------------\n' +
      '----------------------------------------------------------------',
  );
  const user1Id = await createUser([UserRole.coach], 'user1');
  const user2Id = await createUser([UserRole.nurse], 'user2');
  const user3Id = await createUser([UserRole.coach, UserRole.nurse], 'user2');

  console.debug(
    '\n----------------------------------------------------------------\n' +
      '---------------------- Creating a member -----------------------\n' +
      '----------------------------------------------------------------',
  );
  const memberParams = generateCreateMemberParams({
    primaryCoachId: user1Id,
    usersIds: [user2Id, user3Id],
  });

  const { id: memberId } = await mutations.createMember({
    memberParams,
  });
  console.log(
    `${memberId} : member with deviceId ${memberParams.deviceId}\nhaving a user1 ` +
      `as his primaryCoach, user2, user3 as his secondary users`,
  );
  console.debug(
    'In case you want to call getMember:\n' +
      ` 1. go to jwt.io\n` +
      `    1a. add a payload for { username: THE-DEVICE-ID-OF-THE-MEMBER-PRINTED-IN-THE-LINE-ABOVE }\n` +
      "    1b. generate a jwt like so : https://ibb.co/wRj3k7V [this is not a virus, don't worry]\n" +
      ` 2. when calling getMember query, this header should be added:\n` +
      `    'Authorization' : 'Bearer THE-JWT-TOKEN-GENERATED-ABOVE'\n` +
      `    like so : https://ibb.co/TmhMbDL [this is not a virus, don't worry]`,
  );

  console.debug(
    '\n----------------------------------------------------------------\n' +
      '-------- Scheduling appointments with users and member ---------\n' +
      '----------------------------------------------------------------',
  );
  await scheduleAppointment(memberId, user1Id, 'user1');
  await requestAppointment(memberId, user2Id, 'user2');
  await scheduleAppointment(memberId, user2Id, 'user2');
  await scheduleAppointment(memberId, user3Id, 'user3');

  await cleanUp();
}

/***********************************************************************************************************************
 *************************************************** Internal methods **************************************************
 ***********************************************************************************************************************/
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
   * Since we have an eventEmitter updating db, we need to postpone closing the db until after the update occurs.
   * @see [UserService#handleOrderCreatedEvent]
   */
  await new Promise((f) => setTimeout(f, 100));

  await app.close();
};

const createUser = async (
  roles: UserRole[],
  userText: string,
): Promise<string> => {
  const userId = await mutations.createUser({
    userParams: generateCreateUserParams({
      roles,
    }),
  });
  console.log(`${userId} : ${userText} of type ${roles}`);

  return userId;
};

const requestAppointment = async (
  memberId: string,
  userId: string,
  userText: string,
) => {
  const appointment = await mutations.requestAppointment({
    appointmentParams: generateRequestAppointmentParams({
      memberId,
      userId,
    }),
  });
  console.log(
    `${appointment.id} : request appointment for member and ${userText}`,
  );
};

const scheduleAppointment = async (
  memberId: string,
  userId: string,
  userText: string,
) => {
  const appointment = await mutations.scheduleAppointment({
    appointmentParams: generateScheduleAppointmentParams({
      memberId,
      userId,
    }),
  });
  console.log(
    `${appointment.id} : scheduled appointment for member and ${userText}`,
  );
};

(async () => {
  await main();
})();
