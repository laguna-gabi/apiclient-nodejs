import { general } from 'config';
import { addDays, addHours } from 'date-fns';
import * as faker from 'faker';
import { date as fakerDate, lorem } from 'faker';
import { Types } from 'mongoose';
import * as request from 'supertest';
import { buildNPSQuestionnaire } from '../../cmd/static';
import { Appointment, AppointmentDocument } from '../../src/appointment';
import { Availability, AvailabilityDocument } from '../../src/availability';
import {
  BarrierDocument,
  CarePlanDocument,
  CarePlanTypeDocument,
  CreateCarePlanParams,
  RedFlagDocument,
} from '../../src/care';
import { UserRole, delay, reformatDate } from '../../src/common';
import { Communication, CommunicationDocument } from '../../src/communication';
import { DailyReport, DailyReportCategoryTypes } from '../../src/dailyReport';
import {
  ActionItem,
  ActionItemDocument,
  Caregiver,
  CaregiverDocument,
  ControlMember,
  ControlMemberDocument,
  Journal,
  JournalDocument,
  Member,
  MemberDocument,
  ReplaceUserForMemberParams,
  TaskStatus,
} from '../../src/member';
import {
  Questionnaire,
  QuestionnaireDocument,
  QuestionnaireResponse,
  QuestionnaireResponseDocument,
} from '../../src/questionnaire';
import {
  CreateTodoDoneParams,
  CreateTodoParams,
  Todo,
  TodoDocument,
  TodoDoneDocument,
  UpdateTodoParams,
} from '../../src/todo';
import { User, UserConfigDocument, UserDocument } from '../../src/user';
import { AppointmentsIntegrationActions, Creators, Handler } from '../aux';
import {
  checkAuditValues,
  generateAddCaregiverParams,
  generateAvailabilityInput,
  generateCarePlanTypeInput,
  generateCreateCarePlanParams,
  generateCreateMemberParams,
  generateCreateTaskParams,
  generateCreateTodoDoneParams,
  generateCreateTodoParams,
  generateCreateUserParams,
  generateEndAppointmentParams,
  generateOrgParams,
  generateRequestAppointmentParams,
  generateRequestHeaders,
  generateScheduleAppointmentParams,
  generateSetGeneralNotesParams,
  generateUpdateBarrierParams,
  generateUpdateCarePlanParams,
  generateUpdateCaregiverParams,
  generateUpdateMemberParams,
  generateUpdateRedFlagParams,
  generateUpdateTodoParams,
  submitMockCareWizard,
  urls,
} from '../index';

describe('Integration tests : Audit', () => {
  const handler: Handler = new Handler();
  let creators: Creators;
  let appointmentsActions: AppointmentsIntegrationActions;
  let user1: Partial<User>;
  let user2: Partial<User>;
  let adminUser1: Partial<User>;
  let adminUser2: Partial<User>;
  let server;

  beforeAll(async () => {
    await handler.beforeAll();
    server = handler.app.getHttpServer();
    appointmentsActions = new AppointmentsIntegrationActions(
      handler.mutations,
      handler.defaultUserRequestHeaders,
    );
    creators = new Creators(handler, appointmentsActions);
    const createUserParams = [
      generateCreateUserParams(),
      generateCreateUserParams(),
      generateCreateUserParams({ roles: [UserRole.admin] }),
      generateCreateUserParams({ roles: [UserRole.admin] }),
    ];

    const [{ id: userId1 }, { id: userId2 }, { id: adminUser1Id }, { id: adminUser2Id }] =
      await Promise.all(
        createUserParams.map((createUserParams) =>
          handler.mutations.createUser({ createUserParams }),
        ),
      );
    user1 = { id: userId1, ...createUserParams[0] };
    user2 = { id: userId2, ...createUserParams[1] };
    adminUser1 = { id: adminUser1Id, ...createUserParams[2] };
    adminUser2 = { id: adminUser2Id, ...createUserParams[3] };
  }, 10000);

  afterAll(async () => {
    await handler.afterAll();
  });

  describe(Caregiver.name, () => {
    it('should update createdAt and updatedAt fields', async () => {
      /**
       * 1. Add Caregiver for PatientZero and by PatientZero
       * 2. Update Caregiver for PatientZero and by PatientZero's primary user
       *
       * Note: confirm `save` and `findOneAndUpdate` hooks
       */

      // Add Caregiver for PatientZero and by PatientZero:
      const addCaregiverParams = generateAddCaregiverParams({
        memberId: handler.patientZero.id.toString(),
      });

      const { id } = await handler.mutations.addCaregiver({
        addCaregiverParams,
        requestHeaders: generateRequestHeaders(handler.patientZero.authId),
      });

      // confirm that `createdBy` and `updatedBy` are set correctly (of PatientZero)
      expect(
        await checkAuditValues<CaregiverDocument>(
          id,
          handler.caregiverModel,
          handler.patientZero.id.toString(),
          handler.patientZero.id.toString(),
        ),
      ).toBeTruthy();

      // Update Caregiver for PatientZero and by PatientZero's primary user:
      const updateCaregiverParams = generateUpdateCaregiverParams({
        id,
        memberId: handler.patientZero.id.toString(),
      });

      // Get primary user authId and id for token in request header and validation
      const { id: userId, authId: userAuthId } = await handler.userService.get(
        handler.patientZero.primaryUserId.toString(),
      );

      await handler.mutations.updateCaregiver({
        updateCaregiverParams,
        requestHeaders: generateRequestHeaders(userAuthId),
      });

      // confirm that `createdBy` and `updatedBy` are set correctly (only `updatedBy` should change)
      expect(
        await checkAuditValues<CaregiverDocument>(
          id,
          handler.caregiverModel,
          handler.patientZero.id.toString(),
          userId,
        ),
      ).toBeTruthy();
    });
  });

  describe(Todo.name, () => {
    it('should update createdAt and updatedAt fields', async () => {
      /**
       * 1. User creates a todo for member
       * 1.1 confirm `createdAt` === `updatedAt` === User.id for Todo
       * 2. Member update todo
       * 2.1 confirm `createdAt` === User.id && `updatedAt` === Member.id for Todo
       * 3. create TodoDone (by member)
       * 3.1 confirm `createdAt` === `updatedAt` === Member.id for TodoDone
       *
       * Note: confirm `updateOne` (used by the `updateTodo` service method)
       */

      // Get primary user authId and id for token in request header and validation
      const { id: userId, authId: userAuthId } = await handler.userService.get(
        handler.patientZero.primaryUserId.toString(),
      );

      const createTodoParams: CreateTodoParams = generateCreateTodoParams({
        memberId: handler.patientZero.id.toString(),
      });

      const { id } = await handler.mutations.createTodo({
        requestHeaders: generateRequestHeaders(userAuthId),
        createTodoParams,
      });

      // confirm that `createdBy` and `updatedBy` are set correctly (only `updatedBy` should change)
      expect(
        await checkAuditValues<TodoDocument>(id, handler.todoModel, userId, userId),
      ).toBeTruthy();

      const updateTodoParams: UpdateTodoParams = generateUpdateTodoParams({ id });
      const { id: newCreatedTodoId } = await handler.mutations.updateTodo({
        updateTodoParams,
        requestHeaders: generateRequestHeaders(handler.patientZero.authId),
      });

      // confirm that `createdBy` and `updatedBy` are set correctly (only `updatedBy` should change)
      expect(
        await checkAuditValues<TodoDocument>(
          newCreatedTodoId,
          handler.todoModel,
          userId,
          handler.patientZero.id.toString(),
        ),
      ).toBeTruthy();

      const createTodoDoneParams: CreateTodoDoneParams = generateCreateTodoDoneParams({
        todoId: newCreatedTodoId,
      });

      delete createTodoDoneParams.memberId;

      const { id: todoDoneId } = await handler.mutations.createTodoDone({
        createTodoDoneParams: createTodoDoneParams,
        requestHeaders: generateRequestHeaders(handler.patientZero.authId),
      });

      expect(
        await checkAuditValues<TodoDoneDocument>(
          todoDoneId,
          handler.todoDoneModel,
          handler.patientZero.id.toString(),
          handler.patientZero.id.toString(),
        ),
      ).toBeTruthy();
    });

    it('[stress] should update createdAt and updatedAt fields', async () => {
      /**
       * 0. pick a random user (out of 5 users) - user1
       * 1. user1 creates a todo for member
       * 1.1 confirm `createdAt` === `updatedAt` === user1.id for Todo
       * 2. pick a random user (out of 5 users) - user2
       * 2. user2 update todo for patient zero
       * 3.1 confirm newly created todo - `createdAt` === user1.id && `updatedAt` === user2 for Todo
       */

      // create 5 users:
      const users = [];

      for (let i = 0; i < 5; i++) {
        const { id } = await handler.mutations.createUser({
          createUserParams: generateCreateUserParams(),
        });
        users.push(await handler.userService.get(id));
      }

      // run 100 tests to create and update todo's
      const tests = [];
      for (let i = 0; i < 100; i++) {
        tests.push(testRunner(users, handler));
      }

      await Promise.all(tests);
    }, 10000);
  });

  describe(Availability.name, () => {
    it('should create availabilities', async () => {
      const availabilities = Array.from(Array(3)).map(() => generateAvailabilityInput());
      const requestHeaders = generateRequestHeaders(user1.authId);

      const { ids } = await handler.mutations.createAvailabilities({
        requestHeaders,
        availabilities,
      });

      ids.map(async (id) => {
        // confirm that `createdBy` and `updatedBy` are set correctly (only `updatedBy` should change)
        expect(
          await checkAuditValues<AvailabilityDocument>(
            id,
            handler.availabilityModel,
            user1.id,
            user1.id,
          ),
        ).toBeTruthy();
      });
    });
  });

  describe(ActionItem.name, () => {
    it('should update createdBy and updatedBy fields for action item api', async () => {
      const { id } = await handler.mutations.createActionItem({
        createTaskParams: {
          memberId: handler.patientZero.id,
          title: lorem.sentence(),
          deadline: addDays(new Date(), 1),
        },
        requestHeaders: generateRequestHeaders(user1.authId),
      });

      expect(
        await checkAuditValues<ActionItemDocument>(id, handler.actionItemModel, user1.id, user1.id),
      ).toBeTruthy();

      await handler.mutations.updateActionItemStatus({
        updateTaskStatusParams: { id, status: TaskStatus.reached },
        requestHeaders: generateRequestHeaders(user2.authId),
      });

      expect(
        await checkAuditValues<ActionItemDocument>(id, handler.actionItemModel, user1.id, user2.id),
      ).toBeTruthy();
    });
  });

  describe(`${QuestionnaireResponse.name} and ${Questionnaire.name}`, () => {
    it('should create a questionnaire response with createdBy and updatedBy', async () => {
      const { id: questionnaireId } = await handler.mutations.createQuestionnaire({
        createQuestionnaireParams: buildNPSQuestionnaire(),
        requestHeaders: generateRequestHeaders(adminUser1.authId),
      });

      expect(
        await checkAuditValues<QuestionnaireDocument>(
          questionnaireId,
          handler.questionnaireModel,
          adminUser1.id,
          adminUser1.id,
        ),
      ).toBeTruthy();

      const { id } = await handler.mutations.submitQuestionnaireResponse({
        submitQuestionnaireResponseParams: {
          questionnaireId,
          memberId: handler.patientZero.id,
          answers: [{ code: 'q1', value: '1' }],
        },
        requestHeaders: generateRequestHeaders(user1.authId),
      });

      expect(
        await checkAuditValues<QuestionnaireResponseDocument>(
          id,
          handler.questionnaireResponseModel,
          user1.id,
          user1.id,
        ),
      ).toBeTruthy();

      // re-create an NPS (same type) assessment questionnaire - this will update previous template (de-activate)
      await handler.mutations.createQuestionnaire({
        createQuestionnaireParams: buildNPSQuestionnaire(),
        requestHeaders: generateRequestHeaders(adminUser2.authId),
      });

      expect(
        await checkAuditValues<QuestionnaireDocument>(
          questionnaireId,
          handler.questionnaireModel,
          adminUser1.id,
          adminUser2.id,
        ),
      ).toBeTruthy();
    });
  });

  describe(Member.name, () => {
    it('should create a new member without `audit` for anonymous requests (REST)', async () => {
      /**
       * 0. create a member via REST endpoint (anonymous)
       * 1. update member record (updateMember)
       * 2. replace User for Member (replaceUserForMember)
       * 3. create Action Item for Member (createActionItem)
       * 4. set notes (general/nurse) for member (setGeneralNotes)
       */
      const org = await creators.createAndValidateOrg();
      const memberParams = generateCreateMemberParams({
        orgId: org.id,
        userId: user1.id, // we want to make sure we get a valid user with user config
      });

      // Create Member (anonymous/REST)
      const {
        body: { id: memberId },
      } = await request(server).post(urls.members).send(memberParams).expect(201);

      expect(
        await checkAuditValues<MemberDocument>(memberId, handler.memberModel, undefined, undefined),
      ).toBeTruthy();

      const { id: c1id } = await handler.communicationModel.findOne({
        memberId: new Types.ObjectId(memberId),
      });

      expect(
        await checkAuditValues<CommunicationDocument>(
          c1id,
          handler.communicationModel,
          undefined,
          undefined,
        ),
      ).toBeTruthy();

      // Update Member (user1)
      const updateMemberParams = generateUpdateMemberParams({ id: memberId });
      await handler.mutations.updateMember({
        updateMemberParams,
        requestHeaders: generateRequestHeaders(user1.authId),
      });

      expect(
        await checkAuditValues<MemberDocument>(memberId, handler.memberModel, undefined, user1.id),
      ).toBeTruthy();

      // Replace User for Member (admin)
      const replaceUserForMemberParams: ReplaceUserForMemberParams = {
        memberId,
        userId: user2.id,
      };

      await handler.mutations.replaceUserForMember({
        replaceUserForMemberParams,
        requestHeaders: generateRequestHeaders(adminUser1.authId),
      });

      await delay(2000); // wait for event to finish

      // `findOneAndUpdate` is triggered on the communication
      const { id: c2id } = await handler.communicationModel.findOne({
        memberId: new Types.ObjectId(memberId),
      });

      expect(
        await checkAuditValues<CommunicationDocument>(
          c2id,
          handler.communicationModel,
          undefined,
          adminUser1.id,
        ),
      ).toBeTruthy();

      expect(
        await checkAuditValues<MemberDocument>(
          memberId,
          handler.memberModel,
          undefined,
          adminUser1.id,
        ),
      ).toBeTruthy();

      await delay(2000); // wait for event to finish

      // Create Action Item for Member (user2) - this will update the list of actions items
      const createTaskParams = generateCreateTaskParams({ memberId });
      await handler.mutations.createActionItem({
        createTaskParams,
        requestHeaders: generateRequestHeaders(user2.authId),
      });

      expect(
        await checkAuditValues<MemberDocument>(memberId, handler.memberModel, undefined, user2.id),
      ).toBeTruthy();

      // Set general notes for Member (user1) - this will update the general notes / nurse notes fields
      const setGeneralNotesParams = generateSetGeneralNotesParams({ memberId });
      await handler.mutations.setGeneralNotes({
        setGeneralNotesParams,
        requestHeaders: generateRequestHeaders(user1.authId),
      });

      expect(
        await checkAuditValues<MemberDocument>(memberId, handler.memberModel, undefined, user1.id),
      ).toBeTruthy();
    });

    it('should create a new member with correct `audit` values (GQL)', async () => {
      const org = await creators.createAndValidateOrg();
      await creators.createAndValidateUser({ orgId: org.id });
      const memberParams = generateCreateMemberParams({ orgId: org.id });

      handler.featureFlagService.spyOnFeatureFlagControlGroup.mockImplementationOnce(
        async () => false,
      );

      const { id } = await handler.mutations.createMember({
        memberParams,
        requestHeaders: generateRequestHeaders(user1.authId),
      });

      expect(
        await checkAuditValues<MemberDocument>(id, handler.memberModel, user1.id, user1.id),
      ).toBeTruthy();

      const { id: cid } = await handler.communicationModel.findOne({
        memberId: new Types.ObjectId(id),
      });

      expect(
        await checkAuditValues<CommunicationDocument>(
          cid,
          handler.communicationModel,
          user1.id,
          user1.id,
        ),
      ).toBeTruthy();
    });
  });

  describe(DailyReport.name, () => {
    it('should create a dailyReport', async () => {
      const { member } = await creators.createMemberUserAndOptionalOrg();
      const startDate = fakerDate.past();
      const date = reformatDate(startDate.toString(), general.get('dateFormatString'));
      await handler.mutations.setDailyReportCategories({
        requestHeaders: generateRequestHeaders(member.authId),
        dailyReportCategoriesInput: {
          date,
          categories: [{ category: DailyReportCategoryTypes.Pain, rank: 1 }],
        },
      });

      const dailyReport = await handler.dailyReportModel.findOne({
        memberId: new Types.ObjectId(member.id),
      });
      expect(dailyReport.createdBy.toString()).toEqual(member.id);
      expect(dailyReport.updatedBy.toString()).toEqual(member.id);
    });
  });

  describe(ControlMember.name, () => {
    it('should create controlMember', async () => {
      handler.featureFlagService.spyOnFeatureFlagControlGroup.mockImplementationOnce(
        async () => true,
      );
      const requestHeaders = generateRequestHeaders(user1.authId);

      const orgParams = generateOrgParams();
      const { id: orgId } = await handler.mutations.createOrg({ orgParams, requestHeaders });
      const memberParams = generateCreateMemberParams({ orgId });
      const { id } = await handler.mutations.createMember({ memberParams, requestHeaders });

      expect(
        await checkAuditValues<ControlMemberDocument>(
          id,
          handler.controlMemberModel,
          user1.id,
          user1.id,
        ),
      ).toBeTruthy();
    });
  });

  describe(Journal.name, () => {
    it('should create journal', async () => {
      const { id } = await handler.mutations.createJournal({
        requestHeaders: generateRequestHeaders(handler.patientZero.authId),
      });

      expect(
        await checkAuditValues<JournalDocument>(
          id,
          handler.journalModel,
          handler.patientZero.id,
          handler.patientZero.id,
        ),
      ).toBeTruthy();
    });
  });

  describe(User.name, () => {
    it('should create a user + config with createdBy and updatedBy fields', async () => {
      const { id } = await handler.mutations.createUser({
        createUserParams: generateCreateUserParams(),
        requestHeaders: generateRequestHeaders(user1.authId),
      });
      expect(
        await checkAuditValues<UserDocument>(id, handler.userModel, user1.id, user1.id),
      ).toBeTruthy();

      const { _id } = await handler.userConfigModel.findOne({ userId: new Types.ObjectId(id) });
      expect(
        await checkAuditValues<UserConfigDocument>(
          _id,
          handler.userConfigModel,
          user1.id,
          user1.id,
        ),
      ).toBeTruthy();
    });

    it('should update on addAppointmentToUser', async () => {
      const { id } = await handler.mutations.createUser({
        createUserParams: generateCreateUserParams(),
        requestHeaders: generateRequestHeaders(user1.authId),
      });
      await handler.mutations.scheduleAppointment({
        appointmentParams: generateScheduleAppointmentParams({
          memberId: handler.patientZero.id,
          userId: id,
        }),
        requestHeaders: generateRequestHeaders(user2.authId),
      });

      expect(
        await checkAuditValues<UserDocument>(id, handler.userModel, user1.id, user2.id),
      ).toBeTruthy();
    });
  });

  describe('Care', () => {
    it('should update createdAt and updatedAt fields - red flag', async () => {
      /**
       * 1. Submit care wizard result for PatientZero and user1
       * 2. Update red flag for PatientZero and by user2
       *
       * Note: confirm `save` and `findOneAndUpdate` hooks
       */

      const memberId = handler.patientZero.id.toString();
      await submitMockCareWizard(handler, memberId, generateRequestHeaders(user1.authId));

      // get all member's red flags, barriers and care plans
      const memberRedFlags = await handler.queries.getMemberRedFlags({ memberId });

      // confirm that `createdBy` and `updatedBy` are set correctly (of PatientZero)
      expect(
        await checkAuditValues<RedFlagDocument>(
          memberRedFlags[0].id,
          handler.redFlagModel,
          user1.id,
          user1.id,
        ),
      ).toBeTruthy();

      // Update red flag for PatientZero and by an additional user:
      const updateRedFlagParams = generateUpdateRedFlagParams({ id: memberRedFlags[0].id });
      await handler.mutations.updateRedFlag({
        updateRedFlagParams,
        requestHeaders: generateRequestHeaders(user2.authId),
      });

      // confirm that `createdBy` and `updatedBy` are set correctly (only `updatedBy` should change)
      expect(
        await checkAuditValues<RedFlagDocument>(
          memberRedFlags[0].id,
          handler.redFlagModel,
          user1.id,
          user2.id,
        ),
      ).toBeTruthy();
    });

    it('should update createdAt and updatedAt fields - barrier', async () => {
      /**
       * 1. Submit care wizard result for PatientZero and user1
       * 2. Update barrier for PatientZero and by user2
       *
       * Note: confirm `save` and `findOneAndUpdate` hooks
       */

      const memberId = handler.patientZero.id.toString();
      await submitMockCareWizard(handler, memberId, generateRequestHeaders(user1.authId));

      // get all member's barriers
      const memberBarriers = await handler.queries.getMemberBarriers({ memberId });

      // confirm that `createdBy` and `updatedBy` are set correctly (of PatientZero)
      expect(
        await checkAuditValues<BarrierDocument>(
          memberBarriers[0].id,
          handler.barrierModel,
          user1.id,
          user1.id,
        ),
      ).toBeTruthy();

      // Update barrier for PatientZero and by an additional user:
      const updateBarrierParams = generateUpdateBarrierParams({
        id: memberBarriers[0].id,
      });
      await handler.mutations.updateBarrier({
        updateBarrierParams,
        requestHeaders: generateRequestHeaders(user2.authId),
      });

      // confirm that `createdBy` and `updatedBy` are set correctly (only `updatedBy` should change)
      expect(
        await checkAuditValues<BarrierDocument>(
          memberBarriers[0].id,
          handler.barrierModel,
          user1.id,
          user2.id,
        ),
      ).toBeTruthy();
    });

    it('should update createdAt and updatedAt fields - care plan', async () => {
      /**
       * 1. Submit care wizard result for PatientZero and user1
       * 2. Update care plan for PatientZero and by user2
       *
       * Note: confirm `save` and `findOneAndUpdate` hooks
       */

      const memberId = handler.patientZero.id.toString();
      // Submit care wizard for PatientZero and by PatientZero:
      await submitMockCareWizard(handler, memberId, generateRequestHeaders(user1.authId));

      // get all member's care plans
      const memberCarePlans = await handler.queries.getMemberCarePlans({ memberId });

      // confirm that `createdBy` and `updatedBy` are set correctly (of PatientZero)
      expect(
        await checkAuditValues<CarePlanDocument>(
          memberCarePlans[0].id,
          handler.carePlanModel,
          user1.id,
          user1.id,
        ),
      ).toBeTruthy();

      // Update care plan for PatientZero and by an additional user:
      const updateCarePlanParams = generateUpdateCarePlanParams({ id: memberCarePlans[0].id });
      await handler.mutations.updateCarePlan({
        updateCarePlanParams,
        requestHeaders: generateRequestHeaders(user2.authId),
      });

      // confirm that `createdBy` and `updatedBy` are set correctly (only `updatedBy` should change)
      expect(
        await checkAuditValues<CarePlanDocument>(
          memberCarePlans[0].id,
          handler.carePlanModel,
          user1.id,
          user2.id,
        ),
      ).toBeTruthy();
    });

    it('should update createdAt and updatedAt fields - care plan type', async () => {
      /**
       * 1. Submit care wizard result for PatientZero and user1
       *
       * Note: confirm `save` and `findOneAndUpdate` hooks
       */

      const memberId = handler.patientZero.id.toString();
      await submitMockCareWizard(handler, memberId, generateRequestHeaders(user1.authId));

      // create a custom care plan
      const memberBarriers = await handler.queries.getMemberBarriers({
        memberId,
        requestHeaders: generateRequestHeaders(user1.authId),
      });
      const barrierId = memberBarriers[0].id;

      const customDescription = faker.lorem.words(4);
      const createCarePlanParams: CreateCarePlanParams = generateCreateCarePlanParams({
        memberId,
        barrierId,
        type: generateCarePlanTypeInput({ custom: customDescription }),
      });

      await handler.mutations.createCarePlan({
        createCarePlanParams,
        requestHeaders: generateRequestHeaders(user1.authId),
      });

      const carePlanTypes = await handler.queries.getCarePlanTypes();
      const { id: createdCarePlanType } = carePlanTypes.find(
        (i) => i.description === customDescription,
      );
      // confirm that `createdBy` and `updatedBy` are set correctly (of PatientZero)
      expect(
        await checkAuditValues<CarePlanTypeDocument>(
          createdCarePlanType,
          handler.carePlanTypeModel,
          user1.id,
          user1.id,
        ),
      ).toBeTruthy();
    });
  });

  describe(Communication.name, () => {
    it(
      'should set createdBy and updatedBy on communication ' +
        'when scheduleAppointment is invoked',
      async () => {
        const { id: userId } = await handler.mutations.createUser({
          createUserParams: generateCreateUserParams(),
        });

        await handler.mutations.scheduleAppointment({
          appointmentParams: generateScheduleAppointmentParams({
            userId,
            memberId: handler.patientZero.id,
          }),
          requestHeaders: generateRequestHeaders(user1.authId),
        });

        await delay(2000); // wait for event to finish

        // we expect a newly created communication between the new user and the member to get created
        const { id } = await handler.communicationModel.findOne({
          memberId: new Types.ObjectId(handler.patientZero.id),
          userId: new Types.ObjectId(userId.toString()),
        });

        expect(
          await checkAuditValues<CommunicationDocument>(
            id,
            handler.communicationModel,
            user1.id,
            user1.id,
          ),
        ).toBeTruthy();
      },
    );
  });

  describe(Appointment.name, () => {
    it('should set createdBy and updatedBy on requestAppointment', async () => {
      const { id: userId } = await creators.createAndValidateUser();
      const { id } = await handler.mutations.requestAppointment({
        appointmentParams: generateRequestAppointmentParams({
          userId,
          memberId: handler.patientZero.id,
          notBefore: addDays(new Date(), 1),
        }),
        requestHeaders: generateRequestHeaders(user1.authId),
      });

      expect(
        await checkAuditValues<AppointmentDocument>(
          id,
          handler.appointmentModel,
          user1.id,
          user1.id,
        ),
      ).toBeTruthy();
    });

    it('should set createdBy and updatedBy on scheduleAppointment', async () => {
      const { id: userId } = await creators.createAndValidateUser();
      const { id } = await handler.mutations.scheduleAppointment({
        appointmentParams: generateScheduleAppointmentParams({
          userId,
          memberId: handler.patientZero.id,
        }),
        requestHeaders: generateRequestHeaders(user1.authId),
      });

      expect(
        await checkAuditValues<AppointmentDocument>(
          id,
          handler.appointmentModel,
          user1.id,
          user1.id,
        ),
      ).toBeTruthy();
    });

    it('should update createdBy and updatedBy on scheduleAppointment', async () => {
      const { id: userId } = await creators.createAndValidateUser();
      const appointmentParams = generateScheduleAppointmentParams({
        userId,
        memberId: handler.patientZero.id,
      });
      const { id } = await handler.mutations.scheduleAppointment({
        appointmentParams,
        requestHeaders: generateRequestHeaders(user1.authId),
      });

      await handler.mutations.scheduleAppointment({
        appointmentParams: generateScheduleAppointmentParams({
          id,
          userId,
          memberId: handler.patientZero.id,
          start: addHours(new Date(appointmentParams.end), 1),
        }),
        requestHeaders: generateRequestHeaders(user2.authId),
      });

      expect(
        await checkAuditValues<AppointmentDocument>(
          id,
          handler.appointmentModel,
          user1.id,
          user2.id,
        ),
      ).toBeTruthy();
    });

    it('should update createdBy and updatedBy on endAppointment', async () => {
      const { id: userId } = await creators.createAndValidateUser();
      const { id } = await handler.mutations.scheduleAppointment({
        appointmentParams: generateScheduleAppointmentParams({
          userId,
          memberId: handler.patientZero.id,
        }),
        requestHeaders: generateRequestHeaders(user1.authId),
      });

      await handler.mutations.endAppointment({
        endAppointmentParams: generateEndAppointmentParams({ id }),
        requestHeaders: generateRequestHeaders(user2.authId),
      });

      expect(
        await checkAuditValues<AppointmentDocument>(
          id,
          handler.appointmentModel,
          user1.id,
          user2.id,
        ),
      ).toBeTruthy();
    });
  });
});

/**************************************************************************************************
 **************************************** Service methods *****************************************
 *************************************************************************************************/

async function testRunner(users: User[], handler: Handler) {
  const user1 = getRandomUser(users);
  const createTodoParams: CreateTodoParams = generateCreateTodoParams({
    memberId: handler.patientZero.id,
  });

  const { id } = await handler.mutations.createTodo({
    requestHeaders: generateRequestHeaders(user1.authId),
    createTodoParams,
  });

  // confirm that `createdBy` and `updatedBy` are set correctly (only `updatedBy` should change)
  expect(
    await checkAuditValues<TodoDocument>(
      id,
      handler.todoModel,
      user1.id.toString(),
      user1.id.toString(),
    ),
  ).toBeTruthy();

  const user2 = getRandomUser(users);
  const updateTodoParams: UpdateTodoParams = generateUpdateTodoParams({
    memberId: handler.patientZero.id,
    id,
  });
  const { id: newCreatedTodoId } = await handler.mutations.updateTodo({
    updateTodoParams,
    requestHeaders: generateRequestHeaders(user2.authId),
  });

  // confirm that `createdBy` and `updatedBy` are set correctly (only `updatedBy` should change)
  expect(
    await checkAuditValues<TodoDocument>(
      newCreatedTodoId,
      handler.todoModel,
      user1.id.toString(),
      user2.id.toString(),
    ),
  ).toBeTruthy();
}

function getRandomUser(users: User[]): User {
  return users[Math.floor(Math.random() * users.length)];
}
