import { INestApplication, ValidationPipe } from '@nestjs/common';
import { GraphQLModule } from '@nestjs/graphql';
import { Test, TestingModule } from '@nestjs/testing';
import { createTestClient } from 'apollo-server-testing';
import { AppModule } from '../../src/app.module';
import {
  generateCreateMemberParams,
  generateCreateUserParams,
  generateNoShowAppointmentParams,
  generateNoteParam,
  generateRequestAppointmentParams,
  generateScheduleAppointmentParams,
  generateScoresParam,
} from '../index';
import { CreateUserParams, User, UserRole } from '../../src/user';
import { camelCase, omit } from 'lodash';
import { Mutations } from './mutations';
import { Queries } from './queries';
import * as config from 'config';
import * as faker from 'faker';
import { CreateMemberParams, Member } from '../../src/member';
import {
  Appointment,
  AppointmentStatus,
  RequestAppointmentParams,
  SetNotesParams,
} from '../../src/appointment';
import { Errors, ErrorType } from '../../src/common';
import { Types } from 'mongoose';
import * as jwt from 'jsonwebtoken';
import { AppointmentsIntegrationActions } from './appointments';

const validatorsConfig = config.get('graphql.validators');
const stringError = `String cannot represent a non string value`;

describe('Integration graphql resolvers', () => {
  let app: INestApplication;
  let mutations: Mutations;
  let queries: Queries;
  let appointmentsActions: AppointmentsIntegrationActions;
  let module: GraphQLModule;

  const primaryCoachId = new Types.ObjectId().toString();
  const minLength = validatorsConfig.get('name.minLength') as number;
  const maxLength = validatorsConfig.get('name.maxLength') as number;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe());
    await app.init();

    module = moduleFixture.get<GraphQLModule>(GraphQLModule);

    const apolloServer = createTestClient((module as any).apolloServer);
    mutations = new Mutations(apolloServer);
    queries = new Queries(apolloServer);

    appointmentsActions = new AppointmentsIntegrationActions(mutations);
  });

  afterAll(async () => {
    await app.close();
  });

  it('should be able to call all gql mutations and queries', async () => {
    /**
     * 1. Create a user with a single role - coach
     * 2. Create a user with 2 roles - coach and nurse
     * 3. Create a user with 1 role - nurse
     * 4. Create a member with the 3 users above. 1st user is the primaryCoach,
     *    2nd and 3rd users is in users list
     * 5. Create an appointment between the primary coach and the member
     * 6. Create an appointment between the non primary coach (2nd user) and the member
     * 7. Create an appointment between the non primary coach (3rd user) and the member
     * 8. Fetch member and checks all related appointments
     */
    const resultCoach = await createAndValidateUser();
    const resultNurse1 = await createAndValidateUser([UserRole.nurse, UserRole.coach]);
    const resultNurse2 = await createAndValidateUser([UserRole.nurse]);

    const resultMember = await createAndValidateMember({
      primaryCoach: resultCoach,
      coaches: [resultNurse1, resultNurse2],
    });

    const scheduledAppointmentPrimaryCoach = await createAndValidateAppointment({
      userId: resultCoach.id,
      member: resultMember,
    });

    const scheduledAppointmentNurse1 = await createAndValidateAppointment({
      userId: resultNurse1.id,
      member: resultMember,
    });

    const scheduledAppointmentNurse2 = await createAndValidateAppointment({
      userId: resultNurse2.id,
      member: resultMember,
    });

    const member = await queries.getMember();

    expect(member.primaryCoach.appointments[0]).toEqual(
      expect.objectContaining({ status: AppointmentStatus.requested }),
    );
    expect(scheduledAppointmentPrimaryCoach).toEqual(
      expect.objectContaining(member.primaryCoach.appointments[1]),
    );

    expect(member.users[0].appointments[0]).toEqual(
      expect.objectContaining({ status: AppointmentStatus.requested }),
    );
    expect(scheduledAppointmentNurse1).toEqual(
      expect.objectContaining(member.users[0].appointments[1]),
    );

    expect(member.users[1].appointments[0]).toEqual(
      expect.objectContaining({ status: AppointmentStatus.requested }),
    );
    expect(scheduledAppointmentNurse2).toEqual(
      expect.objectContaining(member.users[1].appointments[1]),
    );
  });

  /**
   * Checks that if a user has 2+ appointments with 2+ members,
   * when calling getMember it'll bring the specific member's appointment, and not all appointments
   * 1. user: { id: 'user-123' }
   * 2. member: { id: 'member-123', primaryCoach: { id : 'user-123' } }
   * 3. member: { id: 'member-456', primaryCoach: { id : 'user-123' } }
   * In this case, user has 2 appointments, but when a member requests an appointment,
   * it'll return just the related appointment of a user, and not all appointments.
   */
  it('getAppointments should return just the member appointment of a user', async () => {
    const primaryCoach = await createAndValidateUser();
    const member1 = await createAndValidateMember({ primaryCoach });
    const member2 = await createAndValidateMember({ primaryCoach });

    const appointmentMember1 = await createAndValidateAppointment({
      userId: primaryCoach.id,
      member: member1,
    });

    const appointmentMember2 = await createAndValidateAppointment({
      userId: primaryCoach.id,
      member: member2,
    });

    const primaryCoachWithAppointments = await queries.getUser(primaryCoach.id);
    expect(appointmentMember1).toEqual(
      expect.objectContaining(primaryCoachWithAppointments.appointments[1]),
    );
    expect(appointmentMember2).toEqual(
      expect.objectContaining(primaryCoachWithAppointments.appointments[3]),
    );

    setContextUser(member1.deviceId);
    const memberResult1 = await queries.getMember();
    expect(appointmentMember1).toEqual(
      expect.objectContaining(memberResult1.primaryCoach.appointments[1]),
    );

    setContextUser(member2.deviceId);
    const memberResult2 = await queries.getMember();
    expect(appointmentMember2).toEqual(
      expect.objectContaining(memberResult2.primaryCoach.appointments[1]),
    );
  });

  describe('validations', () => {
    describe('user', () => {
      test.each`
        field            | error
        ${'email'}       | ${`Field "email" of required type "String!" was not provided.`}
        ${'name'}        | ${`Field "name" of required type "String!" was not provided.`}
        ${'roles'}       | ${`Field "roles" of required type "[UserRole!]!" was not provided.`}
        ${'photoUrl'}    | ${`Field "photoUrl" of required type "String!" was not provided.`}
        ${'description'} | ${`Field "description" of required type "String!" was not provided.`}
      `(`should fail to create a user since mandatory field $field is missing`, async (params) => {
        const userParams: CreateUserParams = generateCreateUserParams();
        delete userParams[params.field];
        await mutations.createUser({
          userParams,
          missingFieldError: params.error,
        });
      });

      test.each`
        length           | errorString | error
        ${minLength - 1} | ${'short'}  | ${[Errors.get(ErrorType.userMinMaxLength)]}
        ${maxLength + 1} | ${'long'}   | ${[Errors.get(ErrorType.userMinMaxLength)]}
      `(`should fail to create a user since name is too $errorString`, async (params) => {
        const name = generateRandomName(params.length);
        const userParams: CreateUserParams = generateCreateUserParams({
          name,
        });
        await mutations.createUser({
          userParams,
          invalidFieldsErrors: params.error,
        });
      });

      /* eslint-disable max-len */
      test.each`
        field            | input                               | errors
        ${'email'}       | ${{ email: faker.lorem.word() }}    | ${{ invalidFieldsErrors: [Errors.get(ErrorType.userEmailFormat)] }}
        ${'photoUrl'}    | ${{ photoUrl: faker.lorem.word() }} | ${{ invalidFieldsErrors: [Errors.get(ErrorType.userPhotoUrlFormat)] }}
        ${'email & photoUrl'} | ${{
  email: faker.lorem.word(),
  photoUrl: faker.lorem.word(),
}} | ${{ invalidFieldsErrors: [Errors.get(ErrorType.userEmailFormat), Errors.get(ErrorType.userPhotoUrlFormat)] }}
        ${'description'} | ${{ description: 222 }}             | ${{ missingFieldError: stringError }}
      `(
        /* eslint-enable max-len */
        `should fail to create a user since $field is not valid`,
        async (params) => {
          const userParams: CreateUserParams = generateCreateUserParams(params.input);
          await mutations.createUser({
            userParams,
            ...params.errors,
          });
        },
      );
    });

    describe('member', () => {
      /* eslint-disable max-len */
      test.each`
        field               | error
        ${'phoneNumber'}    | ${`Field "phoneNumber" of required type "String!" was not provided.`}
        ${'name'}           | ${`Field "name" of required type "String!" was not provided.`}
        ${'dateOfBirth'}    | ${`Field "dateOfBirth" of required type "DateTime!" was not provided.`}
        ${'primaryCoachId'} | ${`Field "primaryCoachId" of required type "String!" was not provided.`}
      `(`should fail to create a user since mandatory field $field is missing`, async (params) => {
        /* eslint-enable max-len */
        const memberParams: CreateMemberParams = generateCreateMemberParams({
          primaryCoachId,
        });
        delete memberParams[params.field];
        await mutations.createMember({
          memberParams,
          missingFieldError: params.error,
        });
      });

      test.each`
        length           | errorString | error
        ${minLength - 1} | ${'short'}  | ${[Errors.get(ErrorType.memberMinMaxLength)]}
        ${maxLength + 1} | ${'long'}   | ${[Errors.get(ErrorType.memberMinMaxLength)]}
      `(`should fail to create a member since name is too $errorString`, async (params) => {
        const name = generateRandomName(params.length);
        const memberParams: CreateMemberParams = generateCreateMemberParams({
          primaryCoachId,
          name,
        });
        await mutations.createMember({
          memberParams,
          invalidFieldsErrors: params.error,
        });
      });

      /* eslint-disable max-len */
      test.each`
        field            | input                                                  | errors
        ${'phoneNumber'} | ${{
  primaryCoachId,
  phoneNumber: '+410',
}} | ${[Errors.get(ErrorType.memberPhoneNumber)]}
        ${'dateOfBirth'} | ${{ primaryCoachId, dateOfBirth: faker.lorem.word() }} | ${[Errors.get(ErrorType.memberDate)]}
      `(
        /* eslint-enable max-len */
        `should fail to create a member since $field is not valid`,
        async (params) => {
          const memberParams: CreateMemberParams = generateCreateMemberParams(params.input);
          await mutations.createMember({
            memberParams,
            invalidFieldsErrors: params.errors,
          });
        },
      );
    });

    describe('appointment', () => {
      describe('request', () => {
        test.each`
          field          | error
          ${'userId'}    | ${`Field "userId" of required type "String!" was not provided.`}
          ${'memberId'}  | ${`Field "memberId" of required type "String!" was not provided.`}
          ${'notBefore'} | ${`Field "notBefore" of required type "DateTime!" was not provided.`}
        `(
          `should fail to create an appointment since mandatory field $field is missing`,
          async (params) => {
            const appointmentParams: RequestAppointmentParams = generateRequestAppointmentParams();
            delete appointmentParams[params.field];
            await mutations.requestAppointment({
              appointmentParams,
              missingFieldError: params.error,
            });
          },
        );

        /* eslint-disable max-len */
        test.each`
          field          | input                                | error
          ${'memberId'}  | ${{ memberId: 123 }}                 | ${{ missingFieldError: stringError }}
          ${'userId'}    | ${{ userId: 123 }}                   | ${{ missingFieldError: stringError }}
          ${'notBefore'} | ${{ notBefore: faker.lorem.word() }} | ${{ invalidFieldsErrors: [Errors.get(ErrorType.appointmentNotBeforeDate)] }}
        `(
          /* eslint-enable max-len */
          `should fail to create an appointment since $field is not a valid type`,
          async (params) => {
            const appointmentParams: RequestAppointmentParams = generateRequestAppointmentParams(
              params.input,
            );

            await mutations.requestAppointment({
              appointmentParams,
              ...params.error,
            });
          },
        );

        it('should fail since notBefore date is in the past', async () => {
          const notBefore = new Date();
          notBefore.setMinutes(notBefore.getMinutes() - 1);

          await mutations.requestAppointment({
            appointmentParams: generateRequestAppointmentParams({ notBefore }),
            invalidFieldsErrors: [Errors.get(ErrorType.appointmentNotBeforeDateInThePast)],
          });
        });
      });

      describe('schedule', () => {
        /* eslint-disable max-len */
        test.each`
          field          | error
          ${'memberId'}  | ${`Field "memberId" of required type "String!" was not provided.`}
          ${'userId'}    | ${`Field "userId" of required type "String!" was not provided.`}
          ${'notBefore'} | ${`Field "notBefore" of required type "DateTime!" was not provided.`}
          ${'method'}    | ${`Field "method" of required type "AppointmentMethod!" was not provided.`}
          ${'start'}     | ${`Field "start" of required type "DateTime!" was not provided.`}
          ${'end'}       | ${`Field "end" of required type "DateTime!" was not provided.`}
        `(
          /* eslint-enable max-len */
          `should fail to create an appointment since mandatory field $field is missing`,
          async (params) => {
            const appointmentParams = generateScheduleAppointmentParams();
            delete appointmentParams[params.field];

            await mutations.scheduleAppointment({
              appointmentParams,
              missingFieldError: params.error,
            });
          },
        );

        /* eslint-disable max-len */
        test.each`
          field          | input                         | error
          ${'memberId'}  | ${{ memberId: 123 }}          | ${{ missingFieldError: stringError }}
          ${'userId'}    | ${{ userId: 123 }}            | ${{ missingFieldError: stringError }}
          ${'notBefore'} | ${{ notBefore: 'not-valid' }} | ${{ invalidFieldsErrors: [Errors.get(ErrorType.appointmentNotBeforeDate)] }}
          ${'method'}    | ${{ method: 'not-valid' }}    | ${{ missingFieldError: 'Enum "AppointmentMethod" cannot represent non-string value' }}
          ${'start'}     | ${{ start: 'not-valid' }}     | ${{ invalidFieldsErrors: [Errors.get(ErrorType.appointmentStartDate)] }}
          ${'end'}       | ${{ end: 'not-valid' }}       | ${{ invalidFieldsErrors: [Errors.get(ErrorType.appointmentEndDate)] }}
        `(
          /* eslint-enable max-len */
          `should fail to schedule an appointment since $field is not a valid type`,
          async (params) => {
            const appointmentParams = generateScheduleAppointmentParams();
            appointmentParams[params.field] = params.input;

            await mutations.scheduleAppointment({
              appointmentParams,
              ...params.error,
            });
          },
        );

        it('should validate that an error is thrown if end date is before start date', async () => {
          const end = faker.date.future(1);
          const start = new Date(end);
          start.setMinutes(start.getMinutes() + 1);
          const appointmentParams = generateScheduleAppointmentParams({
            start,
            end,
          });

          await mutations.scheduleAppointment({
            appointmentParams,
            invalidFieldsErrors: [Errors.get(ErrorType.appointmentEndAfterStart)],
          });
        });
      });

      describe('noShow', () => {
        test.each`
          field   | error
          ${'id'} | ${`Field "id" of required type "String!" was not provided.`}
        `(
          `should fail to create an appointment since mandatory field $field is missing`,
          async (params) => {
            const noShowParams = generateNoShowAppointmentParams();
            delete noShowParams[params.field];

            await mutations.noShowAppointment({
              noShowParams,
              missingFieldError: params.error,
            });
          },
        );

        /* eslint-disable max-len */
        test.each`
          field       | input                      | error
          ${'id'}     | ${{ id: 123 }}             | ${{ missingFieldError: stringError }}
          ${'noShow'} | ${{ noShow: 'not-valid' }} | ${{ missingFieldError: 'Boolean cannot represent a non boolean value' }}
          ${'reason'} | ${{ reason: 123 }}         | ${{ missingFieldError: stringError }}
        `(
          /* eslint-enable max-len */
          `should fail to update an appointment no show since $field is not a valid type`,
          async (params) => {
            const noShowParams = generateNoShowAppointmentParams();
            noShowParams[params.field] = params.input;

            await mutations.noShowAppointment({
              noShowParams,
              ...params.error,
            });
          },
        );

        const reason = faker.lorem.sentence();
        test.each`
          input
          ${{ noShow: true }}
          ${{ noShow: false, reason }}
        `(
          /* eslint-disable max-len */
          `should fail to update an appointment no show since noShow and reason combinations are not valid for $input`,
          /* eslint-enable max-len */
          async (params) => {
            const noShowParams = {
              id: new Types.ObjectId().toString(),
              ...params.input,
            };

            await mutations.noShowAppointment({
              noShowParams,
              invalidFieldsErrors: [Errors.get(ErrorType.appointmentNoShow)],
            });
          },
        );
      });

      describe('setNotes', () => {
        /* eslint-disable max-len */
        test.each`
          field              | error
          ${'appointmentId'} | ${`Field "appointmentId" of required type "String!" was not provided.`}
        `(
          /* eslint-enable max-len */
          `should fail to set notes to an appointment since mandatory field $field is missing`,
          async (params) => {
            const noteParams: SetNotesParams = {
              appointmentId: new Types.ObjectId().toString(),
              notes: [generateNoteParam()],
              scores: generateScoresParam(),
            };

            delete noteParams[params.field];

            await mutations.setNotes({
              params: noteParams,
              missingFieldError: params.error,
            });
          },
        );

        test.each`
          field          | error
          ${'adherence'} | ${`Field "adherence" of required type "Float!" was not provided.`}
          ${'wellbeing'} | ${`Field "wellbeing" of required type "Float!" was not provided.`}
        `(
          `should fail to set notes to an appointment since mandatory field $field is missing`,
          async (params) => {
            const noteParams: SetNotesParams = {
              appointmentId: new Types.ObjectId().toString(),
              notes: [generateNoteParam()],
              scores: generateScoresParam(),
            };

            delete noteParams.scores[params.field];

            await mutations.setNotes({
              params: noteParams,
              missingFieldError: params.error,
            });
          },
        );
      });
    });

    const generateRandomName = (length: number): string => {
      return faker.lorem.words(length).substr(0, length);
    };
  });

  /************************************************************************************************
   *************************************** Internal methods ***************************************
   ***********************************************************************************************/

  const createAndValidateUser = async (roles?: UserRole[]): Promise<User> => {
    const userParams: CreateUserParams = generateCreateUserParams({ roles });
    const primaryCoachId = await mutations.createUser({ userParams });

    const result = await queries.getUser(primaryCoachId);

    const expectedUser = {
      ...userParams,
      id: primaryCoachId,
      appointments: [],
    };

    const resultUserNew = omit(result, 'roles');
    const expectedUserNew = omit(expectedUser, 'roles');
    expect(resultUserNew).toEqual(expectedUserNew);

    expect(result.roles).toEqual(expectedUser.roles.map((role) => camelCase(role)));

    return result;
  };

  const createAndValidateMember = async ({ primaryCoach, coaches = [] }): Promise<Member> => {
    const deviceId = faker.datatype.uuid();
    setContextUser(deviceId);
    const apolloServer = createTestClient((module as any).apolloServer);
    mutations = new Mutations(apolloServer);
    queries = new Queries(apolloServer);

    const memberParams = generateCreateMemberParams({
      deviceId,
      primaryCoachId: primaryCoach.id,
      usersIds: coaches.map((coach) => coach.id),
    });

    await mutations.createMember({ memberParams });

    const member = await queries.getMember();

    expect(member.phoneNumber).toEqual(memberParams.phoneNumber);
    expect(member.deviceId).toEqual(deviceId);
    expect(member.name).toEqual(memberParams.name);

    expect(new Date(member.dateOfBirth)).toEqual(new Date(memberParams.dateOfBirth));
    expect(member.primaryCoach).toEqual(primaryCoach);
    expect(member.users).toEqual(coaches);

    return member;
  };

  /**
   * 1. call mutation requestAppointment: created appointment with memberId, userId, notBefore
   * 2. call query getAppointment: returned current appointment with memberId, userId,
   *                               notBefore and status: requested
   * 3. call mutation scheduleAppointment: created new scheduled appointment with status: scheduled
   * 4. call mutation endAppointment: returned current appointment with status: done
   * 5. call mutation freezeAppointment: returned current appointment with status: closed
   * 6. call mutation endAppointment: "unfreeze" returned current appointment with status: done
   * 7. call setNotes 2 times - 2nd time should override the 1st one
   * 8. call query getAppointment: returned current appointment with all fields
   */
  const createAndValidateAppointment = async ({
    userId,
    member,
  }: {
    userId: string;
    member: Member;
  }): Promise<Appointment> => {
    const requestAppointmentResult = await appointmentsActions.requestAppointment(userId, member);

    let appointment = await appointmentsActions.scheduleAppointment(userId, member);

    expect(requestAppointmentResult.id).not.toEqual(appointment.id);

    appointment = await appointmentsActions.endAppointment(appointment.id);
    appointment = await appointmentsActions.freezeAppointment(appointment.id);
    appointment = await appointmentsActions.endAppointment(appointment.id); //Unfreeze
    appointment = await appointmentsActions.showAppointment(appointment.id);

    let notes = [generateNoteParam()];
    let scores = generateScoresParam();
    await appointmentsActions.setNotes(appointment.id, notes, scores);
    let result = await queries.getAppointment(appointment.id);
    expect(result).toEqual({ ...appointment, notes: { notes, scores } });

    notes = [generateNoteParam(), generateNoteParam()];
    scores = generateScoresParam();
    await appointmentsActions.setNotes(appointment.id, notes, scores);
    result = await queries.getAppointment(appointment.id);
    expect(result).toEqual({ ...appointment, notes: { notes, scores } });

    return result;
  };

  const setContextUser = (deviceId: string) => {
    (module as any).apolloServer.context = () => ({
      req: {
        headers: {
          authorization: jwt.sign({ username: deviceId }, 'shhh'),
        },
      },
    });
  };
});
