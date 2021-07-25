import { INestApplication, ValidationPipe } from '@nestjs/common';
import { GraphQLModule } from '@nestjs/graphql';
import { Test, TestingModule } from '@nestjs/testing';
import { createTestClient } from 'apollo-server-testing';
import { AppModule } from '../../src/app.module';
import {
  generateCreateMemberParams,
  generateCreateUserParams,
  generateMemberLinks,
  generateNoShowAppointmentParams,
  generateNotesParams,
  generateOrgParams,
  generateRequestAppointmentParams,
  generateScheduleAppointmentParams,
} from '../index';
import { CreateUserParams, User, UserRole } from '../../src/user';
import { camelCase, omit } from 'lodash';
import { Mutations } from './mutations';
import { Queries } from './queries';
import * as config from 'config';
import * as faker from 'faker';
import { CreateMemberParams, defaultMemberParams, Language, Member, Sex } from '../../src/member';
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
import { CreateOrgParams, Org } from '../../src/org';

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
     * 4. Create an organization
     * 5. Create a member in the organization above with the 3 users above.
     *    1st user is the primaryCoach, 2nd and 3rd users is in users list
     * 6. Create an appointment between the primary coach and the member
     * 7. Create an appointment between the non primary coach (2nd user) and the member
     * 8. Create an appointment between the non primary coach (3rd user) and the member
     * 9. Fetch member and checks all related appointments
     */
    const resultCoach = await createAndValidateUser();
    const resultNurse1 = await createAndValidateUser([UserRole.nurse, UserRole.coach]);
    const resultNurse2 = await createAndValidateUser([UserRole.nurse]);

    const resultOrg = await createAndValidateOrg();
    const resultMember = await createAndValidateMember({
      org: resultOrg,
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
    expect(member.scores).toEqual(scheduledAppointmentNurse2.notes.scores);
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
    const org = await createAndValidateOrg();
    const member1 = await createAndValidateMember({ org, primaryCoach });
    const member2 = await createAndValidateMember({ org, primaryCoach });

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

  it('should validate that exact member scores are updated on notes.scores update', async () => {
    const primaryCoach = await createAndValidateUser();
    const org = await createAndValidateOrg();
    const member1 = await createAndValidateMember({ org, primaryCoach });
    const member2 = await createAndValidateMember({ org, primaryCoach });

    const appointmentMember1 = await createAndValidateAppointment({
      userId: primaryCoach.id,
      member: member1,
    });

    const appointmentMember2 = await createAndValidateAppointment({
      userId: primaryCoach.id,
      member: member2,
    });

    const notes1 = { appointmentId: appointmentMember1.id, ...generateNotesParams() };
    const notes2 = { appointmentId: appointmentMember2.id, ...generateNotesParams() };
    await mutations.setNotes({ params: notes2 });

    setContextUser(member2.deviceId);
    let member2Result = await queries.getMember();
    expect(member2Result.scores).toEqual(notes2.scores);

    setContextUser(member1.deviceId);
    let member1Result = await queries.getMember();
    expect(member1Result.scores).not.toEqual(member2Result.scores);
    await mutations.setNotes({ params: notes1 });
    member1Result = await queries.getMember();
    expect(member1Result.scores).toEqual(notes1.scores);

    setContextUser(member2.deviceId);
    member2Result = await queries.getMember();
    expect(member2Result.scores).toEqual(notes2.scores);
  });

  describe('validations', () => {
    describe('user', () => {
      test.each`
        field            | error
        ${'email'}       | ${`Field "email" of required type "String!" was not provided.`}
        ${'firstName'}   | ${`Field "firstName" of required type "String!" was not provided.`}
        ${'lastName'}    | ${`Field "lastName" of required type "String!" was not provided.`}
        ${'roles'}       | ${`Field "roles" of required type "[UserRole!]!" was not provided.`}
        ${'avatar'}      | ${`Field "avatar" of required type "String!" was not provided.`}
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
        length           | errorString | field
        ${minLength - 1} | ${'short'}  | ${'firstName'}
        ${maxLength + 1} | ${'long'}   | ${'firstName'}
        ${minLength - 1} | ${'short'}  | ${'lastName'}
        ${maxLength + 1} | ${'long'}   | ${'lastName'}
      `(`should fail to create a user since $field is too $errorString`, async (params) => {
        const userParams: CreateUserParams = generateCreateUserParams();
        userParams[params.field] = generateRandomName(params.length);

        await mutations.createUser({
          userParams,
          invalidFieldsErrors: [Errors.get(ErrorType.userMinMaxLength)],
        });
      });

      /* eslint-disable max-len */
      test.each`
        field               | input                                                        | errors
        ${'email'}          | ${{ email: faker.lorem.word() }}                             | ${{ invalidFieldsErrors: [Errors.get(ErrorType.userEmailFormat)] }}
        ${'avatar'}         | ${{ avatar: faker.lorem.word() }}                            | ${{ invalidFieldsErrors: [Errors.get(ErrorType.userAvatarFormat)] }}
        ${'email & avatar'} | ${{ email: faker.lorem.word(), avatar: faker.lorem.word() }} | ${{ invalidFieldsErrors: [Errors.get(ErrorType.userEmailFormat), Errors.get(ErrorType.userAvatarFormat)] }}
        ${'description'}    | ${{ description: 222 }}                                      | ${{ missingFieldError: stringError }}
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

    describe('org', () => {
      test.each`
        field              | error
        ${'name'}          | ${`Field "name" of required type "String!" was not provided.`}
        ${'type'}          | ${`Field "type" of required type "OrgType!" was not provided.`}
        ${'trialDuration'} | ${`Field "trialDuration" of required type "Int!" was not provided.`}
      `(`should fail to create a user since mandatory field $field is missing`, async (params) => {
        const orgParams: CreateOrgParams = generateOrgParams();
        delete orgParams[params.field];
        await mutations.createOrg({ orgParams, missingFieldError: params.error });
      });

      /* eslint-disable max-len */
      test.each`
        field              | input                      | errors
        ${'name'}          | ${{ name: 1 }}             | ${stringError}
        ${'type'}          | ${{ type: 'not-valid' }}   | ${'does not exist in "OrgType" enum'}
        ${'trialDuration'} | ${{ trialDuration: 24.8 }} | ${'Int cannot represent non-integer value'}
      `(
        /* eslint-enable max-len */
        `should fail to create an org since $field is not valid`,
        async (params) => {
          const orgParams: CreateOrgParams = generateOrgParams(params.input);
          await mutations.createOrg({
            orgParams,
            missingFieldError: params.errors,
          });
        },
      );

      it('should validate that trialDuration should be a positive number', async () => {
        const orgParams: CreateOrgParams = generateOrgParams({ trialDuration: 0 });
        await mutations.createOrg({
          orgParams,
          invalidFieldsErrors: [Errors.get(ErrorType.orgTrialDurationOutOfRange)],
        });
      });
    });

    describe('member', () => {
      /* eslint-disable max-len */
      test.each`
        field               | error
        ${'phoneNumber'}    | ${`Field "phoneNumber" of required type "String!" was not provided.`}
        ${'firstName'}      | ${`Field "firstName" of required type "String!" was not provided.`}
        ${'lastName'}       | ${`Field "lastName" of required type "String!" was not provided.`}
        ${'dateOfBirth'}    | ${`Field "dateOfBirth" of required type "DateTime!" was not provided.`}
        ${'primaryCoachId'} | ${`Field "primaryCoachId" of required type "String!" was not provided.`}
      `(`should fail to create a user since mandatory field $field is missing`, async (params) => {
        /* eslint-enable max-len */
        const memberParams: CreateMemberParams = generateCreateMemberParams({
          orgId: new Types.ObjectId().toString(),
          primaryCoachId,
        });
        delete memberParams[params.field];
        await mutations.createMember({
          memberParams,
          missingFieldError: params.error,
        });
      });

      test.each`
        field              | defaultValue
        ${'sex'}           | ${defaultMemberParams.sex}
        ${'email'}         | ${null}
        ${'language'}      | ${defaultMemberParams.language}
        ${'zipCode'}       | ${null}
        ${'dischargeDate'} | ${null}
      `(`should set default value if exists for optional field $field`, async (params) => {
        /* eslint-enable max-len */
        const org: Org = await createAndValidateOrg();
        const primaryCoach: User = await createAndValidateUser();
        const memberParams: CreateMemberParams = generateCreateMemberParams({
          orgId: org.id,
          primaryCoachId: primaryCoach.id,
        });
        delete memberParams[params.field];

        setContextUser(memberParams.deviceId);
        const { id } = await mutations.createMember({ memberParams });
        expect(id).not.toBeUndefined();

        const member = await queries.getMember();
        expect(member[params.field]).toEqual(params.defaultValue);
      });

      test.each`
        field         | value
        ${'sex'}      | ${Sex.female}
        ${'email'}    | ${faker.internet.email()}
        ${'language'} | ${Language.es}
        ${'zipCode'}  | ${faker.address.zipCode()}
      `(`should set value for optional field $field`, async (params) => {
        const org: Org = await createAndValidateOrg();
        const primaryCoach: User = await createAndValidateUser();
        const memberParams: CreateMemberParams = generateCreateMemberParams({
          orgId: org.id,
          primaryCoachId: primaryCoach.id,
        });
        memberParams[params.field] = params.value;

        setContextUser(memberParams.deviceId);
        const { id } = await mutations.createMember({ memberParams });
        expect(id).not.toBeUndefined();

        const member = await queries.getMember();
        expect(member[params.field]).toEqual(params.value);
      });

      it('should set value for optional field dischargeDate', async () => {
        const org: Org = await createAndValidateOrg();
        const primaryCoach: User = await createAndValidateUser();
        const memberParams: CreateMemberParams = generateCreateMemberParams({
          orgId: org.id,
          primaryCoachId: primaryCoach.id,
        });

        memberParams.dischargeDate = faker.date.future(1);

        setContextUser(memberParams.deviceId);
        const { id } = await mutations.createMember({ memberParams });
        expect(id).not.toBeUndefined();

        const member = await queries.getMember();
        expect(new Date(member.dischargeDate)).toEqual(memberParams.dischargeDate);
      });

      /* eslint-disable max-len */
      test.each`
        input                             | error
        ${{ phoneNumber: 123 }}           | ${{ missingFieldError: stringError }}
        ${{ deviceId: 123 }}              | ${{ missingFieldError: stringError }}
        ${{ firstName: 123 }}             | ${{ missingFieldError: stringError }}
        ${{ lastName: 123 }}              | ${{ missingFieldError: stringError }}
        ${{ dateOfBirth: 'not-valid' }}   | ${{ invalidFieldsErrors: [Errors.get(ErrorType.memberDateOfBirth)] }}
        ${{ orgId: 123 }}                 | ${{ missingFieldError: stringError }}
        ${{ primaryCoachId: 123 }}        | ${{ missingFieldError: stringError }}
        ${{ usersIds: [123] }}            | ${{ missingFieldError: stringError }}
        ${{ email: 'not-valid' }}         | ${{ invalidFieldsErrors: [Errors.get(ErrorType.memberEmailFormat)] }}
        ${{ sex: 'not-valid' }}           | ${{ missingFieldError: 'does not exist in "Sex" enum' }}
        ${{ language: 'not-valid' }}      | ${{ missingFieldError: 'does not exist in "Language" enum' }}
        ${{ zipCode: 123 }}               | ${{ missingFieldError: stringError }}
        ${{ dischargeDate: 'not-valid' }} | ${{ invalidFieldsErrors: [Errors.get(ErrorType.memberDischargeDate)] }}
      `(
        /* eslint-enable max-len */
        `should fail to create a member since setting $input is not a valid`,
        async (params) => {
          const memberParams: CreateMemberParams = generateCreateMemberParams({
            orgId: new Types.ObjectId().toString(),
            primaryCoachId,
            ...params.input,
          });

          await mutations.createMember({ memberParams, ...params.error });
        },
      );

      test.each`
        length           | errorString | field
        ${minLength - 1} | ${'short'}  | ${'firstName'}
        ${maxLength + 1} | ${'long'}   | ${'firstName'}
        ${minLength - 1} | ${'short'}  | ${'lastName'}
        ${maxLength + 1} | ${'long'}   | ${'lastName'}
      `(`should fail to create a member since $field is too $errorString`, async (params) => {
        const memberParams: CreateMemberParams = generateCreateMemberParams({
          primaryCoachId,
          orgId: new Types.ObjectId().toString(),
        });
        memberParams[params.field] = generateRandomName(params.length);
        await mutations.createMember({
          memberParams,
          invalidFieldsErrors: [Errors.get(ErrorType.memberMinMaxLength)],
        });
      });

      /* eslint-disable max-len */
      test.each`
        field            | input                                                  | errors
        ${'phoneNumber'} | ${{ primaryCoachId, phoneNumber: '+410' }}             | ${[Errors.get(ErrorType.memberPhoneNumber)]}
        ${'dateOfBirth'} | ${{ primaryCoachId, dateOfBirth: faker.lorem.word() }} | ${[Errors.get(ErrorType.memberDateOfBirth)]}
      `(
        /* eslint-enable max-len */
        `should fail to create a member since $field is not valid`,
        async (params) => {
          const memberParams: CreateMemberParams = generateCreateMemberParams({
            orgId: new Types.ObjectId().toString(),
            primaryCoachId,
            ...params.input,
          });
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
              ...generateNotesParams(),
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
              ...generateNotesParams(),
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
    expect(resultUserNew).toEqual(expect.objectContaining(expectedUserNew));
    expect(new Date(resultUserNew.createdAt)).toEqual(expect.any(Date));

    expect(result.roles).toEqual(expectedUser.roles.map((role) => camelCase(role)));

    return result;
  };

  const createAndValidateOrg = async (): Promise<Org> => {
    const orgParams = generateOrgParams();
    const { id } = await mutations.createOrg({ orgParams });

    expect(id).not.toBeUndefined();

    return { id, ...orgParams };
  };

  const createAndValidateMember = async ({
    org,
    primaryCoach,
    coaches = [],
  }: {
    org: Org;
    primaryCoach: User;
    coaches?: User[];
  }): Promise<Member> => {
    const deviceId = faker.datatype.uuid();
    setContextUser(deviceId);

    const memberParams = generateCreateMemberParams({
      deviceId,
      orgId: org.id,
      primaryCoachId: primaryCoach.id,
      usersIds: coaches.map((coach) => coach.id),
    });
    const links = generateMemberLinks(memberParams.firstName, memberParams.lastName);

    await mutations.createMember({ memberParams });

    const member = await queries.getMember();

    expect(member.phoneNumber).toEqual(memberParams.phoneNumber);
    expect(member.deviceId).toEqual(deviceId);
    expect(member.firstName).toEqual(memberParams.firstName);
    expect(member.lastName).toEqual(memberParams.lastName);

    expect(new Date(member.dateOfBirth)).toEqual(new Date(memberParams.dateOfBirth));
    expect(member.primaryCoach).toEqual(primaryCoach);
    expect(member.users).toEqual(coaches);
    expect(member.dischargeNotesLink).toEqual(links.dischargeNotesLink);
    expect(member.dischargeInstructionsLink).toEqual(links.dischargeInstructionsLink);
    expect(member.org).toEqual(org);
    expect(member.sex).toEqual(defaultMemberParams.sex);
    expect(member.email).toBeNull();
    expect(member.language).toEqual(defaultMemberParams.language);
    expect(member.zipcode).toBeUndefined();
    expect(member.dischargeDate).toBeNull();

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

    let notes = generateNotesParams();
    await mutations.setNotes({ params: { appointmentId: appointment.id, ...notes } });
    let result = await queries.getAppointment(appointment.id);

    expect(result).toEqual({ ...appointment, updatedAt: result.updatedAt, notes });

    notes = generateNotesParams(2);
    await mutations.setNotes({ params: { appointmentId: appointment.id, ...notes } });
    result = await queries.getAppointment(appointment.id);
    expect(result).toEqual({ ...appointment, updatedAt: result.updatedAt, notes });

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
