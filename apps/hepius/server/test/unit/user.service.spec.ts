import { generateId, generateObjectId, mockLogger, mockProcessWarnings } from '@argus/pandora';
import { getModelToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import {
  add,
  addDays,
  areIntervalsOverlapping,
  differenceInMinutes,
  isAfter,
  isSameDay,
  startOfToday,
  startOfTomorrow,
} from 'date-fns';
import { Model, Types, model } from 'mongoose';
import { v4 } from 'uuid';
import {
  compareUsers,
  dbConnect,
  dbDisconnect,
  defaultModules,
  generateAvailabilityInput,
  generateCreateUserParams,
  generateRequestAppointmentParams,
  generateScheduleAppointmentParams,
  generateUpdateUserParams,
} from '..';
import { AppointmentModule, AppointmentResolver } from '../../src/appointment';
import { AvailabilityModule, AvailabilityResolver } from '../../src/availability';
import {
  ErrorType,
  Errors,
  IEventOnNewAppointment,
  IEventOnUpdatedUserAppointments,
  LoggerService,
  defaultTimestampsDbValues,
} from '../../src/common';
import {
  GetSlotsParams,
  NotNullableUserKeys,
  UserDocument,
  UserDto,
  UserModule,
  UserService,
  defaultSlotsParams,
} from '../../src/user';
import { Appointment, User, UserRole, defaultUserParams } from '@argus/hepiusClient';
import { JourneyModule, JourneyService } from '../../src/journey';

describe('UserService', () => {
  let module: TestingModule;
  let service: UserService;
  let journeyService: JourneyService;
  let spyOnJourneyServiceGetRecent;
  let availabilityResolver: AvailabilityResolver;
  let appointmentResolver: AppointmentResolver;
  let mockUserModel;
  let userModel: Model<UserDocument & defaultTimestampsDbValues>;

  beforeAll(async () => {
    mockProcessWarnings(); // to hide pino prettyPrint warning
    module = await Test.createTestingModule({
      imports: defaultModules().concat(
        UserModule,
        AppointmentModule,
        AvailabilityModule,
        JourneyModule,
      ),
      providers: [{ provide: getModelToken(User.name), useValue: Model }],
    }).compile();

    service = module.get<UserService>(UserService);
    availabilityResolver = module.get<AvailabilityResolver>(AvailabilityResolver);
    appointmentResolver = module.get<AppointmentResolver>(AppointmentResolver);
    mockLogger(module.get<LoggerService>(LoggerService));

    journeyService = module.get<JourneyService>(JourneyService);
    spyOnJourneyServiceGetRecent = jest.spyOn(journeyService, 'getRecent');

    userModel = model<UserDocument & defaultTimestampsDbValues>(User.name, UserDto);
    mockUserModel = module.get<Model<User>>(getModelToken(User.name));

    await dbConnect();
  });

  afterAll(async () => {
    await module.close();
    await dbDisconnect();
  });

  afterEach(async () => {
    spyOnJourneyServiceGetRecent.mockReset();
  });

  describe('get+insert', () => {
    it('should return null for non existing user', async () => {
      const result = await service.get(generateId());
      expect(result).toBeNull();
    });

    it('should get the two or more users users created', async () => {
      const user1 = generateCreateUserParams();
      await service.insert(user1);
      const user2 = generateCreateUserParams();
      await service.insert(user2);

      const result = await service.getUsers();
      expect(result.length).toBeGreaterThanOrEqual(2);
    }, 10000);

    it('should get escalation group user(s)', async () => {
      const user = generateCreateUserParams();
      const { id } = await service.insert(user);
      await userModel.updateOne(
        { _id: new Types.ObjectId(id) },
        { $set: { inEscalationGroup: true } },
      );

      const result = await service.getEscalationGroupUsers();
      compareUsers(
        result.find((user) => user.id.toString() === id.toString()),
        user,
      );
    });

    test.each([
      [Object.values(UserRole)],
      [[UserRole.lagunaCoach, UserRole.lagunaNurse]],
      [[UserRole.lagunaCoach]],
      [[UserRole.lagunaNurse]],
    ])('should successfully insert a user having roles : %p', async (roles) => {
      const user = generateCreateUserParams({ roles });

      const { id } = await service.insert(user);
      const result = await service.get(id);

      compareUsers(result, user);
    });

    it('should check that createdAt and updatedAt exists in the collection', async () => {
      const user = generateCreateUserParams();

      const { id } = await service.insert(user);
      const createdUser = await userModel.findById(id);

      expect(createdUser.createdAt).toEqual(expect.any(Date));
      expect(createdUser.updatedAt).toEqual(expect.any(Date));
    });

    it('should insert a user without optional params + validate all fields', async () => {
      const user = generateCreateUserParams();
      delete user.title;
      delete user.languages;
      delete user.maxMembers;
      delete user.roles;
      delete user.avatar;
      delete user.description;

      const { id } = await service.insert(user);
      const result = await service.get(id);

      compareUsers(result, {
        ...user,
        languages: defaultUserParams.languages,
        maxMembers: defaultUserParams.maxMembers,
        roles: defaultUserParams.roles,
        avatar: defaultUserParams.avatar,
      });
    });

    it('should remove not nullable optional params if null is passed', async () => {
      const user = generateCreateUserParams();
      NotNullableUserKeys.forEach((key) => {
        user[key] = null;
      });

      const { id } = await service.insert(user);
      const result = await service.get(id);

      NotNullableUserKeys.forEach((key) => {
        expect(result).not.toHaveProperty(key, null);
      });
    });

    it('should fail to insert an already existing user', async () => {
      const user = generateCreateUserParams();
      await service.insert(user);

      await expect(service.insert(user)).rejects.toThrow(
        Errors.get(ErrorType.userIdOrEmailAlreadyExists),
      );
    });

    const USER1 = generateId();
    const USER2 = generateId();
    const USER3 = generateId();
    const journey = { memberId: generateObjectId() };

    it.each([
      {
        users: [
          { _id: USER1, journeys: [], lastMemberAssignedAt: new Date(0), maxMembers: 1 },
          { _id: USER2, journeys: [], lastMemberAssignedAt: new Date(1), maxMembers: 1 },
          { _id: USER3, journeys: [], lastMemberAssignedAt: new Date(2), maxMembers: 1 },
        ],
        userId: USER1,
      },
      {
        users: [
          { _id: USER1, journeys: [journey], lastMemberAssignedAt: new Date(0), maxMembers: 1 },
          { _id: USER2, journeys: [journey], lastMemberAssignedAt: new Date(1), maxMembers: 2 },
          { _id: USER3, journeys: [], lastMemberAssignedAt: new Date(2), maxMembers: 1 },
        ],
        userId: USER2,
      },
      {
        users: [
          { _id: USER1, journeys: [journey], lastMemberAssignedAt: new Date(0), maxMembers: 1 },
          {
            _id: USER2,
            journeys: [journey, journey],
            lastMemberAssignedAt: new Date(1),
            maxMembers: 1,
          },
          { _id: USER3, journeys: [], lastMemberAssignedAt: new Date(2), maxMembers: 1 },
        ],
        userId: USER3,
      },
      {
        users: [
          { _id: USER1, journeys: [journey], lastMemberAssignedAt: new Date(0), maxMembers: 1 },
          { _id: USER2, journeys: [], lastMemberAssignedAt: new Date(1), maxMembers: 1 },
          { _id: USER3, journeys: [journey], lastMemberAssignedAt: new Date(2), maxMembers: 1 },
        ],
        userId: USER2,
      },
      {
        users: [
          { _id: USER1, journeys: [journey], lastMemberAssignedAt: new Date(0), maxMembers: 2 },
          { _id: USER2, journeys: [journey], lastMemberAssignedAt: new Date(1), maxMembers: 1 },
          { _id: USER3, journeys: [], lastMemberAssignedAt: new Date(2), maxMembers: 1 },
        ],
        userId: USER1,
      },
      {
        users: [
          {
            _id: USER1,
            journeys: [journey, { memberId: generateObjectId() }],
            lastMemberAssignedAt: new Date(0),
            maxMembers: 2,
          },
          {
            _id: USER2,
            journeys: [{ memberId: generateObjectId() }],
            lastMemberAssignedAt: new Date(1),
            maxMembers: 2,
          },
          { _id: USER3, journeys: [], lastMemberAssignedAt: new Date(2), maxMembers: 1 },
        ],
        userId: USER2,
      },
    ])('should get available user', async ({ users, userId }) => {
      jest.spyOn(mockUserModel, 'aggregate').mockResolvedValue(users);
      const result = await service.getAvailableUser();
      expect(result).toEqual(userId);
      jest.spyOn(mockUserModel, 'aggregate').mockRestore();
    });
  });

  describe('update', () => {
    it('should throw when trying to update non existing user', async () => {
      await expect(service.update({ id: generateId() })).rejects.toThrow(
        Errors.get(ErrorType.userNotFound),
      );
    });

    it('should not change anything if only id is provided', async () => {
      const createUserParams = generateCreateUserParams();
      const user = await service.insert(createUserParams);

      await service.update({ id: user.id });

      const result = await service.get(user.id);
      expect(result).toMatchObject(user);
    });

    it('should be able to update partial fields', async () => {
      const createUserParams = generateCreateUserParams();
      const { id } = await service.insert(createUserParams);
      const updateUserParams = generateUpdateUserParams({ id });
      const updatedUser = await service.update(updateUserParams);
      delete updatedUser.id;

      const result = await service.get(id);
      expect(result).toEqual(expect.objectContaining(updatedUser));
    });

    it('should not set null values input', async () => {
      const createUserParams = generateCreateUserParams();
      const { id } = await service.insert(createUserParams);
      const updateUserParams = generateUpdateUserParams({ id });
      updateUserParams.orgs = null;
      await service.update(updateUserParams);

      const result = await service.get(id);
      expect(result.orgs[0].toString()).toEqual(createUserParams.orgs[0]);
      expect(result.orgs[1].toString()).toEqual(createUserParams.orgs[1]);
    });
  });

  describe('delete', () => {
    it('should do nothing when trying to delete a on non existing userId', async () => {
      await service.delete(generateId());
    });

    it('should delete an existing user', async () => {
      const createUserParams = generateCreateUserParams();
      const user = await service.insert(createUserParams);

      await service.delete(user.id);

      const result = await service.get(user.id);
      expect(result).toBeNull();
    });
  });

  describe('updateAuthId', () => {
    it('should throw when trying to update authId for a non existing user', async () => {
      await expect(service.updateAuthIdAndUsername(generateId(), v4(), v4())).rejects.toThrow(
        Errors.get(ErrorType.userNotFound),
      );
    });

    it('should update authId on an existing user', async () => {
      const createUserParams = generateCreateUserParams();
      const { id } = await service.insert(createUserParams);

      const authId = v4();
      const user = await service.updateAuthIdAndUsername(id, authId, createUserParams.firstName);

      const result = await service.get(id);
      expect(result).toMatchObject({ ...user, authId });
    });
  });

  describe('getAvailableUser', () => {
    // eslint-disable-next-line max-len
    it('admin user should not be returned as available user on default user role filtering', async () => {
      // create user as setup
      const user = generateCreateUserParams();
      await service.insert(user);
      // create admin user
      const adminOnlyUser = generateCreateUserParams({ roles: [UserRole.lagunaAdmin] });
      const insertedUser = await service.insert(adminOnlyUser);
      await userModel.updateOne(
        { _id: new Types.ObjectId(insertedUser.id) },
        // update so it will pop-up first on search
        { $set: { lastMemberAssignedAt: new Date(-10000) } },
      );

      const availableUserId = await service.getAvailableUser();

      expect(availableUserId).not.toEqual(insertedUser.id);

      // clean up
      await userModel.deleteOne({ _id: new Types.ObjectId(insertedUser.id) });
    });

    // eslint-disable-next-line max-len
    it('nurse user should not be returned as available user on default user role filtering', async () => {
      // create user as setup
      const user = generateCreateUserParams();
      await service.insert(user);
      // create nurse user
      const adminOnlyUser = generateCreateUserParams({ roles: [UserRole.lagunaNurse] });
      const insertedUser = await service.insert(adminOnlyUser);
      await userModel.updateOne(
        { _id: new Types.ObjectId(insertedUser.id) },
        // update so it will pop-up first on search
        { $set: { lastMemberAssignedAt: new Date(-10000) } },
      );

      const availableUserId = await service.getAvailableUser();
      expect(availableUserId).not.toEqual(insertedUser.id);

      // clean up
      await userModel.deleteOne({ _id: new Types.ObjectId(insertedUser.id) });
    });

    it('should throw an exception when there are no users', async () => {
      await expect(service.getAvailableUser(generateId())).rejects.toThrow(
        Errors.get(ErrorType.userNoUsersFound),
      );
    });
  });

  describe('userConfig', () => {
    it('should create userConfig on userCreate', async () => {
      const user = generateCreateUserParams();
      const createdUser = await service.insert(user);
      const CreatedConfigUser = await service.getUserConfig(createdUser.id);

      expect(createdUser.id).toEqual(CreatedConfigUser.userId.toString());
    });
  });

  describe('updateUserAppointments', () => {
    it('should move appointments from old user to new user', async () => {
      const oldUser = await service.insert(generateCreateUserParams());
      const newUser = await service.insert(generateCreateUserParams());
      const memberId = generateId();

      // Insert appointments to oldUser
      const mockAppointments = [];
      for (let step = 0; step < 5; step++) {
        const appointment = generateScheduleAppointmentParams({ id: generateId() });
        mockAppointments.push(appointment);
        const params: IEventOnNewAppointment = {
          appointmentId: appointment.id,
          userId: oldUser.id,
          memberId,
        };
        await service.addAppointmentToUser(params);
      }
      const params: IEventOnUpdatedUserAppointments = {
        newUserId: newUser.id,
        oldUserId: oldUser.id,
        memberId,
        appointments: mockAppointments,
      };

      await service.updateUserAppointments(params);

      // Not using service.get because it populates the appointments, and they don't really exist
      const updatedOldUser = (await userModel.findById(oldUser.id)).toObject();
      const updatedNewUser = (await userModel.findById(newUser.id)).toObject();
      const mockAppointmentsIds = mockAppointments.map((app) => new Types.ObjectId(app.id));

      expect(updatedNewUser['appointments']).toEqual(mockAppointmentsIds);
      expect(updatedOldUser['appointments']).toEqual([]);
    });
  });

  describe('getUserSlots', () => {
    let spyOnServiceGetUsersMembersCurrentJourneys;

    beforeEach(() => {
      spyOnServiceGetUsersMembersCurrentJourneys = jest.spyOn(
        service,
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        'getUsersMembersCurrentJourneys',
      );
    });

    afterEach(() => {
      spyOnServiceGetUsersMembersCurrentJourneys.mockReset();
    });

    it('there should not be a slot overlapping a scheduled appointment', async () => {
      const journeyId = generateId();
      spyOnServiceGetUsersMembersCurrentJourneys.mockImplementationOnce(async () => {
        return { journeyIds: [generateObjectId(journeyId)] };
      });

      const user = await service.insert(generateCreateUserParams());
      await createDefaultAvailabilities(user.id);

      const appointment = await scheduleAppointmentWithDate({
        memberId: generateId(),
        userId: user.id,
        journeyId,
        start: add(startOfToday(), { hours: 11 }),
        end: add(startOfToday(), { hours: 11, minutes: defaultSlotsParams.duration }),
      });

      const result = await service.getSlots({
        userId: user.id,
        notBefore: add(startOfToday(), { hours: 10 }),
      });

      for (let index = 0; index < defaultSlotsParams.maxSlots; index++) {
        expect(
          areIntervalsOverlapping(
            {
              start: new Date(result.slots[index]),
              end: add(new Date(result.slots[index]), {
                minutes: defaultSlotsParams.duration,
              }),
            },
            {
              start: new Date(appointment.start),
              end: new Date(appointment.end),
            },
          ),
        ).toEqual(false);
      }
    });

    // eslint-disable-next-line max-len
    it(`should return ${defaultSlotsParams.defaultSlots} default slots if availability in the past`, async () => {
      spyOnServiceGetUsersMembersCurrentJourneys.mockImplementationOnce(async () => []);

      const user = await service.insert(generateCreateUserParams());
      await availabilityResolver.createAvailabilities(user.id, [
        generateAvailabilityInput({
          start: add(startOfToday(), { hours: 8 }),
          end: add(startOfToday(), { hours: 10 }),
        }),
      ]);

      const result = await service.getSlots({
        userId: user.id,
        notBefore: add(startOfToday(), { hours: 10 }),
      });

      expect(result.slots.length).toEqual(defaultSlotsParams.defaultSlots);
    });

    // eslint-disable-next-line max-len
    it(`should return ${defaultSlotsParams.defaultSlots} default slots if there is no availability`, async () => {
      spyOnServiceGetUsersMembersCurrentJourneys.mockImplementationOnce(async () => []);

      const user = await service.insert(generateCreateUserParams());
      const result = await service.getSlots({
        userId: user.id,
        notBefore: add(startOfToday(), { hours: 10 }),
      });

      expect(result.slots.length).toEqual(defaultSlotsParams.defaultSlots);
    });

    /* eslint-disable-next-line max-len */
    it('should return specific default slots if there is no availability and got defaultSlotsCount', async () => {
      spyOnServiceGetUsersMembersCurrentJourneys.mockImplementationOnce(async () => []);

      const user = await service.insert(generateCreateUserParams());
      const result = await service.getSlots({
        userId: user.id,
        notBefore: add(startOfToday(), { hours: 10 }),
        defaultSlotsCount: 9,
      });

      expect(result.slots.length).toEqual(9);
    });

    /* eslint-disable-next-line max-len */
    it('should return 0 slots if there is no availability and allowEmptySlotsResponse=true', async () => {
      spyOnServiceGetUsersMembersCurrentJourneys.mockImplementationOnce(async () => []);

      const user = await service.insert(generateCreateUserParams());
      const result = await service.getSlots({
        userId: user.id,
        notBefore: add(startOfToday(), { hours: 10 }),
        defaultSlotsCount: 9,
        allowEmptySlotsResponse: true,
      });

      expect(result.slots.length).toEqual(0);
    });

    /* eslint-disable-next-line max-len */
    it('should return slots if availabilities exists and allowEmptySlotsResponse=true', async () => {
      spyOnServiceGetUsersMembersCurrentJourneys.mockImplementationOnce(async () => []);

      const user = await service.insert(generateCreateUserParams());
      await availabilityResolver.createAvailabilities(user.id, [
        generateAvailabilityInput({
          start: startOfToday(),
          end: add(startOfToday(), { days: 1 }),
        }),
      ]);

      // this is the query as harmony does
      const result = await service.getSlots({
        userId: user.id,
        notBefore: add(startOfToday(), { hours: 10 }),
        notAfter: add(startOfToday(), { hours: 24 }),
        allowEmptySlotsResponse: true,
      });

      expect(result.slots.length).toEqual(defaultSlotsParams.defaultSlots + 1);
    });

    test.each([true, false])(
      'should not return past slots when allowEmptySlotsResponse=true (%p}',
      async (allowEmptySlotsResponse) => {
        spyOnServiceGetUsersMembersCurrentJourneys.mockImplementationOnce(async () => []);

        const user = await service.insert(generateCreateUserParams());
        await availabilityResolver.createAvailabilities(user.id, [
          generateAvailabilityInput({
            start: add(startOfToday(), { days: -3 }),
            end: add(startOfToday(), { days: -1 }),
          }),
        ]);
        const result = await service.getSlots({
          userId: user.id,
          notBefore: add(startOfToday(), { hours: 10 }),
          defaultSlotsCount: 9,
          allowEmptySlotsResponse,
        });
        if (allowEmptySlotsResponse) {
          expect(result.slots.length).toEqual(0);
        } else {
          expect(result.slots.length).toBeGreaterThan(0);
        }
      },
    );

    it("should not return past slots for 'not before' in the past", async () => {
      spyOnServiceGetUsersMembersCurrentJourneys.mockImplementationOnce(async () => []);

      const user = await service.insert(generateCreateUserParams());
      await availabilityResolver.createAvailabilities(user.id, [
        generateAvailabilityInput({
          start: add(startOfToday(), { days: -3 }),
          end: add(startOfToday(), { days: 3 }),
        }),
      ]);
      const result = await service.getSlots({
        userId: user.id,
        notBefore: add(startOfToday(), { days: -2 }),
        defaultSlotsCount: 9,
      });
      expect(result.slots[0].getTime()).toBeGreaterThan(Date.now());
    });

    it(`should return ${
      defaultSlotsParams.defaultSlots - 1
    } slots from today and the next from tomorrow`, async () => {
      const result = await preformGetUserSlots();

      for (let index = 0; index < defaultSlotsParams.defaultSlots + 1; index++) {
        expect(isSameDay(new Date(result.slots[index]), new Date())).toEqual(true);
      }

      const tomorrow = addDays(new Date(), 1);
      for (
        let index = defaultSlotsParams.defaultSlots + 1;
        index < defaultSlotsParams.maxSlots;
        index++
      ) {
        expect(isSameDay(new Date(result.slots[index]), tomorrow)).toEqual(true);
      }
    });

    it('should return more then default(9) slots if maxSlots is given', async () => {
      const result = await preformGetUserSlots({ maxSlots: 10 });
      expect(result.slots.length).toBe(10);
    });

    // eslint-disable-next-line max-len
    it(`should return ${defaultSlotsParams.defaultSlots} slots only from today if capped by notAfter to this midnight`, async () => {
      const result = await preformGetUserSlots({ notAfter: startOfTomorrow() });
      expect(result.slots.length).toBeGreaterThanOrEqual(defaultSlotsParams.defaultSlots);
      for (let index = 0; index < defaultSlotsParams.defaultSlots - 1; index++) {
        expect(
          isSameDay(new Date(result.slots[index]), add(startOfToday(), { hours: 12 })),
        ).toEqual(true);
      }
    });

    it('check slots default properties and order', async () => {
      const result = await preformGetUserSlots();

      for (let index = 1; index < defaultSlotsParams.maxSlots; index++) {
        expect(
          differenceInMinutes(new Date(result.slots[index]), new Date(result.slots[index - 1])),
        ).toBeGreaterThanOrEqual(defaultSlotsParams.duration);
        expect(isAfter(new Date(result.slots[index]), new Date(result.slots[index - 1]))).toEqual(
          true,
        );
      }
      expect(result.slots.length).toEqual(defaultSlotsParams.maxSlots);
    });

    /* eslint-disable-next-line max-len */
    it('should return default slots from appointments "notBefore" if not specified in params', async () => {
      const journeyId = generateId();
      spyOnServiceGetUsersMembersCurrentJourneys.mockImplementationOnce(async () => {
        return { journeyIds: [generateObjectId(journeyId)] };
      });

      const user = await service.insert(generateCreateUserParams());
      const future = add(startOfToday(), { days: 2, hours: 17 });
      const memberId = generateId();
      const appointmentParams = generateRequestAppointmentParams({
        memberId,
        userId: user.id,
        notBefore: future,
      });

      spyOnJourneyServiceGetRecent.mockResolvedValue({ id: journeyId });
      const appointment = await appointmentResolver.requestAppointment(appointmentParams);
      //mock event listener action
      await service.addAppointmentToUser({
        appointmentId: appointment.id,
        userId: user.id,
        memberId,
      });

      const result = await service.getSlots({
        appointmentId: appointment.id,
      });

      expect(isAfter(result.slots[0], future)).toBeTruthy();
      expect(isAfter(result.slots[0], add(future, { days: 1 }))).toBeFalsy();
    });

    it('should include deleted appointment slot time', async () => {
      const journeyId = generateId();
      spyOnServiceGetUsersMembersCurrentJourneys.mockImplementationOnce(async () => {
        return { journeyIds: [generateObjectId(journeyId)] };
      });

      const user = await service.insert(generateCreateUserParams());
      await createDefaultAvailabilities(user.id);

      const appointment = await scheduleAppointmentWithDate({
        memberId: generateId(),
        userId: user.id,
        journeyId,
        start: add(startOfTomorrow(), { hours: 11 }),
        end: add(startOfTomorrow(), { hours: 11, minutes: defaultSlotsParams.duration }),
      });

      await appointmentResolver.deleteAppointment(user.id, appointment.id);

      const result = await service.getSlots({
        userId: user.id,
        notBefore: add(startOfTomorrow(), { hours: 10 }),
      });

      expect(result.slots[2]).toEqual(appointment.start);
      expect(result.slots[3]).toEqual(appointment.end);
    });

    const preformGetUserSlots = async (override: Partial<GetSlotsParams> = {}) => {
      const journeyId = generateId();
      spyOnServiceGetUsersMembersCurrentJourneys.mockImplementationOnce(async () => {
        return { journeyIds: [generateObjectId(journeyId)] };
      });

      const user = await service.insert(generateCreateUserParams());
      await createDefaultAvailabilities(user.id);

      await scheduleAppointmentWithDate({
        memberId: generateId(),
        userId: user.id,
        journeyId,
        start: add(startOfToday(), { hours: 9 }),
        end: add(startOfToday(), { hours: 9, minutes: defaultSlotsParams.duration }),
      });

      return service.getSlots({
        userId: user.id,
        notBefore: add(startOfToday(), { hours: 10 }),
        ...override,
      });
    };

    const scheduleAppointmentWithDate = async ({
      memberId,
      userId,
      journeyId,
      start,
      end,
    }: {
      memberId: string;
      userId: string;
      journeyId: string;
      start: Date;
      end: Date;
    }): Promise<Appointment> => {
      const appointmentParams = generateScheduleAppointmentParams({
        memberId,
        userId,
        start,
        end,
      });

      spyOnJourneyServiceGetRecent.mockResolvedValue({ id: journeyId });
      return appointmentResolver.scheduleAppointment(appointmentParams);
    };

    const createDefaultAvailabilities = async (userId: string) => {
      return availabilityResolver.createAvailabilities(userId, [
        generateAvailabilityInput({
          start: add(startOfToday(), { hours: 10 }),
          end: add(startOfToday(), { hours: 22 }),
        }),
        generateAvailabilityInput({
          start: add(startOfTomorrow(), { hours: 10 }),
          end: add(startOfTomorrow(), { hours: 22 }),
        }),
      ]);
    };
  });

  describe('setLatestQueryAlert', () => {
    it('should create userConfig on userCreate', async () => {
      const user = generateCreateUserParams();
      const createdUser = await service.insert(user);

      expect(createdUser.lastQueryAlert).toBeFalsy();

      const updatedUser = await service.setLatestQueryAlert(createdUser.id);

      expect(updatedUser.lastQueryAlert).toBeTruthy();
    });
  });
});
