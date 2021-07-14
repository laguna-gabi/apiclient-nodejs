import { INestApplication, ValidationPipe } from '@nestjs/common';
import { GraphQLModule } from '@nestjs/graphql';
import { Test, TestingModule } from '@nestjs/testing';
import { createTestClient } from 'apollo-server-testing';
import { AppModule } from '../../src/app.module';
import {
  generateCreateAppointmentParams,
  generateCreateMemberParams,
  generateCreateUserParams,
  generateScheduleAppointmentParams,
  generateNoShowAppointmentParams,
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
  AppointmentMethod,
  AppointmentStatus,
  CreateAppointmentParams,
} from '../../src/appointment';
import { Errors, ErrorType } from '../../src/common';
import { Types } from 'mongoose';
import * as jwt from 'jsonwebtoken';

const validatorsConfig = config.get('graphql.validators');
const deviceId = faker.datatype.uuid();

describe('Integration graphql resolvers', () => {
  let app: INestApplication;
  let mutations: Mutations;
  let queries: Queries;

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

    const module: GraphQLModule =
      moduleFixture.get<GraphQLModule>(GraphQLModule);

    (module as any).apolloServer.context = () => ({
      req: {
        headers: {
          authorization: jwt.sign({ username: deviceId }, 'shhh'),
        },
      },
    });

    const apolloServer = createTestClient((module as any).apolloServer);
    mutations = new Mutations(apolloServer);
    queries = new Queries(apolloServer);
  });

  afterAll(async () => {
    await app.close();
  });

  it('should be able to call all gql mutations and queries', async () => {
    /**
     * 1. Create a user with a single role - coach
     * 2. Create a user with 2 roles - coach and nurse
     * 3. Create a member with the 2 users above, the 1st user is the primaryCoach, and the 2nd user is in users list
     * 4. Create an appointment between the 1st coach and the member
     * 5. Schedule the appointment to a 1 hour meeting
     */
    const resultCoach = await createAndValidateUser();
    const resultNurse = await createAndValidateUser([
      UserRole.nurse,
      UserRole.coach,
    ]);

    const resultMember = await createAndValidateMember({
      primaryCoach: resultCoach,
      coaches: [resultNurse],
    });

    await createAndValidateAppointment({
      userId: resultCoach.id,
      member: resultMember,
    });
  });

  describe('validations', () => {
    describe('user', () => {
      test.each`
        field         | error
        ${'email'}    | ${`Field "email" of required type "String!" was not provided.`}
        ${'name'}     | ${`Field "name" of required type "String!" was not provided.`}
        ${'roles'}    | ${`Field "roles" of required type "[UserRole!]!" was not provided.`}
        ${'photoUrl'} | ${`Field "photoUrl" of required type "String!" was not provided.`}
      `(
        `should fail to create a user since mandatory field $field is missing`,
        async (params) => {
          const userParams: CreateUserParams = generateCreateUserParams();
          delete userParams[params.field];
          await mutations.createUser({
            userParams,
            missingFieldError: params.error,
          });
        },
      );

      test.each`
        length           | errorString | error
        ${minLength - 1} | ${'short'}  | ${[Errors.get(ErrorType.userMinMaxLength)]}
        ${maxLength + 1} | ${'long'}   | ${[Errors.get(ErrorType.userMinMaxLength)]}
      `(
        `should fail to create a user since name is too $errorString`,
        async (params) => {
          const name = generateRandomName(params.length);
          const userParams: CreateUserParams = generateCreateUserParams({
            name,
          });
          await mutations.createUser({
            userParams,
            invalidFieldsErrors: params.error,
          });
        },
      );

      /* eslint-disable max-len */
      test.each`
        field                 | input                                                          | errors
        ${'email'}            | ${{ email: faker.lorem.word() }}                               | ${[Errors.get(ErrorType.userEmailFormat)]}
        ${'photoUrl'}         | ${{ photoUrl: faker.lorem.word() }}                            | ${[Errors.get(ErrorType.userPhotoUrlFormat)]}
        ${'email & photoUrl'} | ${{ email: faker.lorem.word(), photoUrl: faker.lorem.word() }} | ${[Errors.get(ErrorType.userEmailFormat), Errors.get(ErrorType.userPhotoUrlFormat)]}
      `(
        /* eslint-enable max-len */
        `should fail to create a user since $field is not valid`,
        async (params) => {
          const userParams: CreateUserParams = generateCreateUserParams(
            params.input,
          );
          await mutations.createUser({
            userParams,
            invalidFieldsErrors: params.errors,
          });
        },
      );
    });

    describe('member', () => {
      test.each`
        field               | error
        ${'phoneNumber'}    | ${`Field "phoneNumber" of required type "String!" was not provided.`}
        ${'name'}           | ${`Field "name" of required type "String!" was not provided.`}
        ${'dateOfBirth'}    | ${`Field "dateOfBirth" of required type "DateTime!" was not provided.`}
        ${'primaryCoachId'} | ${`Field "primaryCoachId" of required type "String!" was not provided.`}
      `(
        `should fail to create a user since mandatory field $field is missing`,
        async (params) => {
          const memberParams: CreateMemberParams = generateCreateMemberParams({
            primaryCoachId,
          });
          delete memberParams[params.field];
          await mutations.createMember({
            memberParams,
            missingFieldError: params.error,
          });
        },
      );

      test.each`
        length           | errorString | error
        ${minLength - 1} | ${'short'}  | ${[Errors.get(ErrorType.memberMinMaxLength)]}
        ${maxLength + 1} | ${'long'}   | ${[Errors.get(ErrorType.memberMinMaxLength)]}
      `(
        `should fail to create a member since name is too $errorString`,
        async (params) => {
          const name = generateRandomName(params.length);
          const memberParams: CreateMemberParams = generateCreateMemberParams({
            primaryCoachId,
            name,
          });
          await mutations.createMember({
            memberParams,
            invalidFieldsErrors: params.error,
          });
        },
      );

      /* eslint-disable max-len */
      test.each`
        field            | input                                                  | errors
        ${'phoneNumber'} | ${{ primaryCoachId, phoneNumber: '+410' }}             | ${[Errors.get(ErrorType.memberPhoneNumber)]}
        ${'dateOfBirth'} | ${{ primaryCoachId, dateOfBirth: faker.lorem.word() }} | ${[Errors.get(ErrorType.memberDate)]}
      `(
        /* eslint-enable max-len */
        `should fail to create a member since $field is not valid`,
        async (params) => {
          const memberParams: CreateMemberParams = generateCreateMemberParams(
            params.input,
          );
          await mutations.createMember({
            memberParams,
            invalidFieldsErrors: params.errors,
          });
        },
      );
    });

    describe('appointment', () => {
      describe('insert', () => {
        test.each`
          field          | error
          ${'userId'}    | ${`Field "userId" of required type "String!" was not provided.`}
          ${'memberId'}  | ${`Field "memberId" of required type "String!" was not provided.`}
          ${'notBefore'} | ${`Field "notBefore" of required type "DateTime!" was not provided.`}
        `(
          `should fail to create an appointment since mandatory field $field is missing`,
          async (params) => {
            const appointmentParams: CreateAppointmentParams =
              generateCreateAppointmentParams();
            delete appointmentParams[params.field];
            await mutations.createAppointment({
              appointmentParams,
              missingFieldError: params.error,
            });
          },
        );

        /* eslint-disable max-len */
        test.each`
          field          | input                                | error
          ${'memberId'}  | ${{ memberId: 123 }}                 | ${{ missingFieldError: 'String cannot represent a non string value' }}
          ${'userId'}    | ${{ userId: 123 }}                   | ${{ missingFieldError: 'String cannot represent a non string value' }}
          ${'notBefore'} | ${{ notBefore: faker.lorem.word() }} | ${{ invalidFieldsErrors: [Errors.get(ErrorType.appointmentNotBeforeDate)] }}
        `(
          /* eslint-enable max-len */
          `should fail to create an appointment since $field is not a valid type`,
          async (params) => {
            const appointmentParams: CreateAppointmentParams =
              generateCreateAppointmentParams(params.input);

            await mutations.createAppointment({
              appointmentParams,
              ...params.error,
            });
          },
        );

        it('should fail since notBefore date is in the past', async () => {
          const notBefore = new Date();
          notBefore.setMinutes(notBefore.getMinutes() - 1);

          await mutations.createAppointment({
            appointmentParams: generateCreateAppointmentParams({ notBefore }),
            invalidFieldsErrors: [
              Errors.get(ErrorType.appointmentNotBeforeDateInThePast),
            ],
          });
        });
      });

      describe('schedule', () => {
        test.each`
          field       | error
          ${'id'}     | ${`Field "id" of required type "String!" was not provided.`}
          ${'method'} | ${`Field "method" of required type "AppointmentMethod!" was not provided.`}
          ${'start'}  | ${`Field "start" of required type "DateTime!" was not provided.`}
          ${'end'}    | ${`Field "end" of required type "DateTime!" was not provided.`}
        `(
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
          field       | input                      | error
          ${'id'}     | ${{ id: 123 }}             | ${{ missingFieldError: 'String cannot represent a non string value' }}
          ${'method'} | ${{ method: 'not-valid' }} | ${{ missingFieldError: 'Enum "AppointmentMethod" cannot represent non-string value' }}
          ${'start'}  | ${{ start: 'not-valid' }}  | ${{ invalidFieldsErrors: [Errors.get(ErrorType.appointmentStartDate)] }}
          ${'end'}    | ${{ end: 'not-valid' }}    | ${{ invalidFieldsErrors: [Errors.get(ErrorType.appointmentEndDate)] }}
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
            invalidFieldsErrors: [
              Errors.get(ErrorType.appointmentEndAfterStart),
            ],
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
          ${'id'}     | ${{ id: 123 }}             | ${{ missingFieldError: 'String cannot represent a non string value' }}
          ${'noShow'} | ${{ noShow: 'not-valid' }} | ${{ missingFieldError: 'Boolean cannot represent a non boolean value' }}
          ${'reason'} | ${{ reason: 123 }}         | ${{ missingFieldError: 'String cannot represent a non string value' }}
        `(
          /* eslint-enable max-len */
          `should fail to update an appointment no show since $field is not a valid type`,
          async (params) => {
            const noShowParams = {
              id: new Types.ObjectId().toString(),
              noShow: true,
              reason: faker.lorem.sentence(),
            };
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
          `should fail to update an appointment no show since noShow and reason combinations are not valid for $input`,
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
    });

    const generateRandomName = (length: number): string => {
      return faker.lorem.words(length).substr(0, length);
    };
  });

  /*********************************************************************************************************************
   *********************************************************************************************************************
   ************************************************** Internal methods *************************************************
   *********************************************************************************************************************
   ********************************************************************************************************************/

  const createAndValidateUser = async (roles?: UserRole[]): Promise<User> => {
    const userParams: CreateUserParams = generateCreateUserParams({ roles });
    const primaryCoachId = await mutations.createUser({ userParams });

    const result = await queries.getUser(primaryCoachId);

    const expectedUser = { ...userParams, id: primaryCoachId };

    const resultUserNew = omit(result, 'roles');
    const expectedUserNew = omit(expectedUser, 'roles');
    expect(resultUserNew).toEqual(expectedUserNew);

    expect(result.roles).toEqual(
      expectedUser.roles.map((role) => camelCase(role)),
    );

    return result;
  };

  const createAndValidateMember = async ({
    primaryCoach,
    coaches = [],
  }): Promise<Member> => {
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

    expect(new Date(member.dateOfBirth)).toEqual(
      new Date(memberParams.dateOfBirth),
    );
    expect(member.primaryCoach).toEqual(primaryCoach);
    expect(member.users).toEqual(coaches);

    return member;
  };

  /**
   * 1. call mutation createAppointment: created appointment with memberId, userId, notBefore
   * 2. call query getAppointment: returned current appointment with memberId, userId, notBefore and status: requested
   * 3. call mutation scheduleAppointment: returned current appointment with status: scheduled
   * 4. call mutation endAppointment: returned current appointment with status: done
   * 5. call mutation freezeAppointment: returned current appointment with status: closed
   * 6. call mutation endAppointment: "unfreeze" returned current appointment with status: done
   * 7. call query getAppointment: returned current appointment with all fields
   */
  const createAndValidateAppointment = async ({
    userId,
    member,
  }: {
    userId: string;
    member: Member;
  }): Promise<Appointment> => {
    const appointmentParams = generateCreateAppointmentParams({
      memberId: member.id,
      userId,
    });
    const appointmentResult = await mutations.createAppointment({
      appointmentParams,
    });

    expect(appointmentResult.userId).toEqual(userId);
    expect(appointmentResult.memberId).toEqual(member.id);
    expect(new Date(appointmentResult.notBefore)).toEqual(
      new Date(appointmentParams.notBefore),
    );

    const start = new Date();
    const end = new Date();
    end.setHours(end.getHours() + 2);

    let appointment = await mutations.scheduleAppointment({
      appointmentParams: {
        id: appointmentResult.id,
        method: AppointmentMethod.chat,
        start,
        end,
      },
    });

    expect(appointment.status).toEqual(AppointmentStatus.scheduled);
    expect(appointmentResult.status).toEqual(AppointmentStatus.requested);
    expect(appointment.id).toEqual(appointmentResult.id);
    expect(appointment.memberId).toEqual(appointmentResult.memberId);
    expect(appointment.userId).toEqual(appointmentResult.userId);
    expect(appointment.notBefore).toEqual(appointmentResult.notBefore);
    expect(new Date(appointment.start)).toEqual(start);
    expect(new Date(appointment.end)).toEqual(end);

    appointment = await mutations.endAppointment({ id: appointmentResult.id });
    expect(appointment.status).toEqual(AppointmentStatus.done);

    appointment = await mutations.freezeAppointment({
      id: appointmentResult.id,
    });
    expect(appointment.status).toEqual(AppointmentStatus.closed);

    //"unfreeze"
    appointment = await mutations.endAppointment({ id: appointmentResult.id });
    expect(appointment.status).toEqual(AppointmentStatus.done);

    const noShowParams = generateNoShowAppointmentParams({
      id: appointmentResult.id,
    });
    appointment = await mutations.noShowAppointment({ noShowParams });
    expect(appointment.noShow).toEqual({
      noShow: noShowParams.noShow,
      reason: noShowParams.reason,
    });

    appointment = await mutations.noShowAppointment({
      noShowParams: {
        id: appointmentResult.id,
        noShow: false,
      },
    });
    expect(appointment.noShow).toEqual({ noShow: false, reason: null });

    const appointmentResult2 = await queries.getAppointment(
      appointmentResult.id,
    );
    expect(appointment).toEqual(appointmentResult2);

    return appointment;
  };
});
