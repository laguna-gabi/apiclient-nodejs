import { MemberRole, UserRole } from '@argus/hepiusClient';
import { TodoInternalKey, generateDispatchId } from '@argus/irisClient';
import {
  NotificationType,
  generateId,
  generateObjectId,
  mockLogger,
  mockProcessWarnings,
} from '@argus/pandora';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Test, TestingModule } from '@nestjs/testing';
import {
  dbDisconnect,
  defaultModules,
  generateCreateActionTodoParams,
  generateCreateTodoDoneParams,
  generateCreateTodoParams,
  generateGetTodoDonesParams,
  generateUpdateTodoParams,
  mockGenerateActionTodo,
  mockGenerateMember,
  mockGenerateTodo,
  mockGenerateTodoDone,
} from '..';
import { ErrorType, Errors, EventType, LoggerService } from '../../src/common';
import { JourneyModule, JourneyService } from '../../src/journey';
import {
  ActionTodoLabel,
  CreateActionTodoParams,
  CreateTodoDoneParams,
  CreateTodoParams,
  TodoLabel,
  TodoModule,
  TodoResolver,
  TodoService,
  TodoStatus,
  UpdateTodoParams,
} from '../../src/todo';

describe('TodoResolver', () => {
  let module: TestingModule;
  let resolver: TodoResolver;
  let service: TodoService;
  let journeyService: JourneyService;
  let eventEmitter: EventEmitter2;
  let spyOnEventEmitter;

  beforeAll(async () => {
    mockProcessWarnings(); // to hide pino prettyPrint warning
    module = await Test.createTestingModule({
      imports: defaultModules().concat(TodoModule, JourneyModule),
    }).compile();

    resolver = module.get<TodoResolver>(TodoResolver);
    service = module.get<TodoService>(TodoService);
    journeyService = module.get<JourneyService>(JourneyService);
    eventEmitter = module.get<EventEmitter2>(EventEmitter2);
    spyOnEventEmitter = jest.spyOn(eventEmitter, 'emit');

    mockLogger(module.get<LoggerService>(LoggerService));
  });

  afterAll(async () => {
    await module.close();
    await dbDisconnect();
  });

  afterEach(() => {
    spyOnEventEmitter.mockReset();
  });

  describe('createTodo', () => {
    let spyOnServiceCreateTodo;
    let spyOnJourneyServiceGetRecent;

    beforeEach(() => {
      spyOnServiceCreateTodo = jest.spyOn(service, 'createTodo');
      spyOnJourneyServiceGetRecent = jest.spyOn(journeyService, 'getRecent');
    });

    afterEach(() => {
      spyOnServiceCreateTodo.mockReset();
      spyOnJourneyServiceGetRecent.mockReset();
      spyOnEventEmitter.mockReset();
    });

    it('should create a Todo by member', async () => {
      const memberId = generateId();
      const journeyId = generateId();
      const todo = mockGenerateTodo({
        memberId: generateObjectId(memberId),
        journeyId: generateObjectId(journeyId),
      });
      const params: CreateTodoParams = generateCreateTodoParams({ memberId });
      spyOnServiceCreateTodo.mockImplementationOnce(async () => todo);
      spyOnJourneyServiceGetRecent.mockResolvedValue({ id: journeyId });

      const result = await resolver.createTodo([MemberRole.member], memberId, params);

      expect(spyOnJourneyServiceGetRecent).toHaveBeenCalledWith(memberId);
      expect(spyOnServiceCreateTodo).toHaveBeenCalledWith({
        ...params,
        journeyId,
        status: TodoStatus.active,
      });
      expect(result).toEqual({ id: todo.id });
    });

    test.each([UserRole.lagunaCoach, UserRole.lagunaNurse])(
      'should create a Todo by user',
      async (role) => {
        const memberId = generateId();
        const journeyId = generateId();
        const userId = generateId();
        const todo = mockGenerateTodo({
          memberId: generateObjectId(memberId),
          journeyId: generateObjectId(journeyId),
        });
        const params: CreateTodoParams = generateCreateTodoParams({ memberId });
        delete params.label;
        spyOnServiceCreateTodo.mockImplementationOnce(async () => todo);
        spyOnJourneyServiceGetRecent.mockResolvedValue({ id: journeyId });

        const result = await resolver.createTodo([role], userId, params);

        expect(spyOnJourneyServiceGetRecent).toHaveBeenCalledWith(memberId);
        expect(spyOnServiceCreateTodo).toHaveBeenCalledWith({
          ...params,
          journeyId,
          status: TodoStatus.active,
        });
        expect(result).toEqual({ id: todo.id });
      },
    );

    [UserRole.lagunaCoach, UserRole.lagunaNurse, UserRole.lagunaAdmin].forEach((role) => {
      test.each([TodoLabel.Meds, TodoLabel.Appointment, undefined])(
        `should create a Todo by ${role} and send notification to member`,
        async (label) => {
          const memberId = generateId();
          const journeyId = generateId();
          const userId = generateId();
          const todo = mockGenerateTodo({
            memberId: generateObjectId(memberId),
            journeyId: generateObjectId(journeyId),
            label,
          });
          const params: CreateTodoParams = generateCreateTodoParams({ memberId });
          delete params.label;
          spyOnServiceCreateTodo.mockImplementationOnce(async () => todo);
          spyOnJourneyServiceGetRecent.mockResolvedValue({ id: journeyId });

          const result = await resolver.createTodo([role], userId, params);

          expect(spyOnJourneyServiceGetRecent).toHaveBeenCalledWith(memberId);
          expect(spyOnServiceCreateTodo).toHaveBeenCalledWith({
            ...params,
            journeyId,
            status: TodoStatus.active,
          });
          expect(result).toEqual({ id: todo.id });

          const contentKey = TodoInternalKey[`createTodo${todo.label ? todo.label : 'Todo'}`];
          expect(spyOnEventEmitter).toBeCalledWith(EventType.notifyDispatch, {
            correlationId: expect.any(String),
            dispatchId: generateDispatchId(contentKey, todo.memberId.toString(), todo.id),
            notificationType: NotificationType.text,
            recipientClientId: todo.memberId.toString(),
            senderClientId: userId,
            contentKey,
            path: 'todo',
          });
        },
      );
    });

    test.each([UserRole.lagunaCoach, UserRole.lagunaNurse, UserRole.lagunaAdmin])(
      `should create a Todo by user in status requested if label ${TodoLabel.Meds}`,
      async (role) => {
        const memberId = generateId();
        const journeyId = generateId();
        const userId = generateId();
        const todo = mockGenerateTodo({
          memberId: generateObjectId(memberId),
          journeyId: generateObjectId(journeyId),
        });
        const params: CreateTodoParams = generateCreateTodoParams({
          memberId,
          label: TodoLabel.Meds,
        });
        spyOnServiceCreateTodo.mockImplementationOnce(async () => todo);
        spyOnJourneyServiceGetRecent.mockResolvedValue({ id: journeyId });

        const result = await resolver.createTodo([role], userId, params);

        expect(spyOnJourneyServiceGetRecent).toHaveBeenCalledWith(memberId);
        expect(spyOnServiceCreateTodo).toHaveBeenCalledWith({
          ...params,
          status: TodoStatus.requested,
          journeyId,
        });
        expect(result).toEqual({ id: todo.id });
      },
    );
  });

  describe('createActionTodo', () => {
    let spyOnServiceCreateActionTodo;
    let spyOnJourneyServiceGetRecent;

    beforeEach(() => {
      spyOnServiceCreateActionTodo = jest.spyOn(service, 'createActionTodo');
      spyOnJourneyServiceGetRecent = jest.spyOn(journeyService, 'getRecent');
    });

    afterEach(() => {
      spyOnServiceCreateActionTodo.mockReset();
      spyOnJourneyServiceGetRecent.mockReset();
      spyOnEventEmitter.mockReset();
    });

    [UserRole.lagunaCoach, UserRole.lagunaNurse, UserRole.lagunaAdmin].forEach((role) => {
      test.each([ActionTodoLabel.Questionnaire, ActionTodoLabel.Explore])(
        `should create action Todo by ${role} and send notification to member`,
        async (label) => {
          const memberId = generateId();
          const journeyId = generateId();
          const userId = generateId();
          const todo = mockGenerateActionTodo({
            memberId: generateObjectId(memberId),
            journeyId: generateObjectId(journeyId),
            label,
          });
          const params: CreateActionTodoParams = generateCreateActionTodoParams({
            memberId,
            label,
          });
          spyOnServiceCreateActionTodo.mockImplementationOnce(async () => todo);
          spyOnJourneyServiceGetRecent.mockResolvedValue({ id: journeyId });

          const result = await resolver.createActionTodo([role], userId, params);

          expect(spyOnServiceCreateActionTodo).toHaveBeenCalledWith({ ...params, journeyId });
          expect(result).toEqual({ id: todo.id });

          const contentKey = TodoInternalKey[`createTodo${label}`];
          expect(spyOnEventEmitter).toBeCalledWith(EventType.notifyDispatch, {
            correlationId: expect.any(String),
            dispatchId: generateDispatchId(contentKey, todo.memberId.toString(), todo.id),
            notificationType: NotificationType.text,
            recipientClientId: todo.memberId.toString(),
            senderClientId: userId,
            contentKey,
            path: 'todo',
          });
        },
      );
    });

    [UserRole.lagunaCoach, UserRole.lagunaNurse, UserRole.lagunaAdmin].forEach((role) => {
      test.each([ActionTodoLabel.Journal, ActionTodoLabel.Scanner])(
        `should create action Todo by ${role} and send notification to member`,
        async (label) => {
          const memberId = generateId();
          const journeyId = generateId();
          const userId = generateId();
          const todo = mockGenerateActionTodo({
            memberId: generateObjectId(memberId),
            journeyId: generateObjectId(journeyId),
            label,
          });
          const params: CreateActionTodoParams = generateCreateActionTodoParams({
            memberId,
            label,
          });
          spyOnServiceCreateActionTodo.mockImplementationOnce(async () => todo);
          spyOnJourneyServiceGetRecent.mockResolvedValue({ id: journeyId });

          const result = await resolver.createActionTodo([role], userId, params);

          expect(spyOnServiceCreateActionTodo).toHaveBeenCalledWith({ ...params, journeyId });
          expect(result).toEqual({ id: todo.id });

          const contentKey = TodoInternalKey.createTodoTodo;
          expect(spyOnEventEmitter).toBeCalledWith(EventType.notifyDispatch, {
            correlationId: expect.any(String),
            dispatchId: generateDispatchId(contentKey, todo.memberId.toString(), todo.id),
            notificationType: NotificationType.text,
            recipientClientId: todo.memberId.toString(),
            senderClientId: userId,
            contentKey,
            path: 'todo',
          });
        },
      );
    });
  });

  describe('getTodos', () => {
    let spyOnServiceGetTodos;
    let spyOnJourneyServiceGetRecent;

    beforeEach(() => {
      spyOnServiceGetTodos = jest.spyOn(service, 'getTodos');
      spyOnJourneyServiceGetRecent = jest.spyOn(journeyService, 'getRecent');
    });

    afterEach(() => {
      spyOnServiceGetTodos.mockReset();
      spyOnJourneyServiceGetRecent.mockReset();
    });

    it('should get Todos by member', async () => {
      const member = mockGenerateMember();
      const memberId = member.id;
      const journeyId = generateId();
      const todos = [
        mockGenerateTodo({
          memberId: generateObjectId(memberId),
          journeyId: generateObjectId(journeyId),
          createdBy: generateObjectId(memberId),
          updatedBy: generateObjectId(memberId),
        }),
        mockGenerateTodo({
          memberId: generateObjectId(memberId),
          journeyId: generateObjectId(journeyId),
          createdBy: generateObjectId(memberId),
          updatedBy: generateObjectId(memberId),
        }),
      ];
      spyOnServiceGetTodos.mockImplementationOnce(async () => todos);
      spyOnJourneyServiceGetRecent.mockResolvedValue({ id: journeyId });

      const result = await resolver.getTodos(memberId);

      expect(spyOnServiceGetTodos).toHaveBeenCalledWith(memberId, journeyId);
      expect(result).toEqual(todos);
    });
  });

  describe('updateTodo', () => {
    let spyOnServiceUpdateTodo;
    let spyOnJourneyServiceGetRecent;

    beforeEach(() => {
      spyOnServiceUpdateTodo = jest.spyOn(service, 'updateTodo');
      spyOnJourneyServiceGetRecent = jest.spyOn(journeyService, 'getRecent');
    });

    afterEach(() => {
      spyOnServiceUpdateTodo.mockReset();
      spyOnJourneyServiceGetRecent.mockReset();
      spyOnEventEmitter.mockReset();
    });

    it('should update Todo by member', async () => {
      const member = mockGenerateMember();
      const memberId = member.id;
      const journeyId = generateId();
      const newTodo = mockGenerateTodo({
        memberId: generateObjectId(memberId),
        journeyId: generateObjectId(journeyId),
        createdBy: generateObjectId(memberId),
        updatedBy: generateObjectId(memberId),
      });
      const params: UpdateTodoParams = generateUpdateTodoParams();
      spyOnServiceUpdateTodo.mockImplementationOnce(async () => newTodo);
      spyOnJourneyServiceGetRecent.mockResolvedValue({ id: journeyId });

      const result = await resolver.updateTodo([MemberRole.member], memberId, params);

      expect(spyOnServiceUpdateTodo).toHaveBeenCalledWith({
        ...params,
        journeyId,
        status: TodoStatus.active,
      });
      expect(result).toEqual(newTodo);
    });

    test.each([UserRole.lagunaCoach, UserRole.lagunaNurse])(
      'should update Todo by user',
      async (role) => {
        const memberId = generateId();
        const journeyId = generateId();
        const userId = generateId();
        const newTodo = mockGenerateTodo({
          memberId: generateObjectId(memberId),
          journeyId: generateObjectId(journeyId),
          createdBy: generateObjectId(memberId),
          updatedBy: generateObjectId(memberId),
        });
        const params: UpdateTodoParams = generateUpdateTodoParams({ memberId });
        delete params.label;
        spyOnServiceUpdateTodo.mockImplementationOnce(async () => newTodo);
        spyOnJourneyServiceGetRecent.mockResolvedValue({ id: journeyId });

        const result = await resolver.updateTodo([role], userId, params);

        expect(spyOnServiceUpdateTodo).toHaveBeenCalledWith({
          ...params,
          journeyId,
          status: TodoStatus.active,
        });
        expect(result).toEqual(newTodo);
      },
    );

    [UserRole.lagunaCoach, UserRole.lagunaNurse, UserRole.lagunaAdmin].forEach((role) => {
      test.each([TodoLabel.Meds, TodoLabel.Appointment, undefined])(
        `should update a Todo by ${role} and send notification to member with label = %p`,
        async (label) => {
          const memberId = generateId();
          const journeyId = generateId();
          const userId = generateId();
          const newTodo = mockGenerateTodo({
            memberId: generateObjectId(memberId),
            journeyId: generateObjectId(journeyId),
            createdBy: generateObjectId(memberId),
            updatedBy: generateObjectId(memberId),
            label,
          });
          const params: UpdateTodoParams = generateUpdateTodoParams({ memberId });
          spyOnServiceUpdateTodo.mockImplementationOnce(async () => newTodo);
          spyOnJourneyServiceGetRecent.mockResolvedValue({ id: journeyId });

          await resolver.updateTodo([role], userId, params);

          const contentKey = TodoInternalKey[`updateTodo${newTodo.label ? newTodo.label : 'Todo'}`];
          expect(spyOnEventEmitter).toBeCalledWith(EventType.notifyDispatch, {
            correlationId: expect.any(String),
            dispatchId: generateDispatchId(contentKey, newTodo.memberId.toString(), newTodo.id),
            notificationType: NotificationType.text,
            recipientClientId: newTodo.memberId.toString(),
            senderClientId: userId,
            contentKey,
            path: 'todo',
          });
        },
      );
    });

    test.each([UserRole.lagunaCoach, UserRole.lagunaNurse, UserRole.lagunaAdmin])(
      `should update Todo by user in status requested if label ${TodoLabel.Meds}`,
      async (role) => {
        const memberId = generateId();
        const journeyId = generateId();
        const userId = generateId();
        const newTodo = mockGenerateTodo({
          memberId: generateObjectId(memberId),
          journeyId: generateObjectId(journeyId),
        });
        const params: UpdateTodoParams = generateUpdateTodoParams({
          memberId,
          journeyId,
          label: TodoLabel.Meds,
        });
        spyOnServiceUpdateTodo.mockImplementationOnce(async () => newTodo);
        spyOnJourneyServiceGetRecent.mockResolvedValue({ id: journeyId });

        const result = await resolver.updateTodo([role], userId, params);

        expect(spyOnServiceUpdateTodo).toHaveBeenCalledWith({
          ...params,
          status: TodoStatus.requested,
        });
        expect(result).toEqual(newTodo);
      },
    );
  });

  describe('endTodo', () => {
    let spyOnServiceGetTodo;
    let spyOnServiceEndTodo;
    let spyOnJourneyServiceGetRecent;

    beforeEach(() => {
      spyOnServiceGetTodo = jest.spyOn(service, 'getTodo');
      spyOnServiceEndTodo = jest.spyOn(service, 'endTodo');
      spyOnJourneyServiceGetRecent = jest.spyOn(journeyService, 'getRecent');
    });

    afterEach(() => {
      spyOnServiceGetTodo.mockReset();
      spyOnServiceEndTodo.mockReset();
      spyOnJourneyServiceGetRecent.mockReset();
      spyOnEventEmitter.mockReset();
    });

    it('should end Todo by member', async () => {
      const memberId = generateId();
      const journeyId = generateId();
      const id = generateId();
      const todo = mockGenerateTodo({
        id,
        memberId: generateObjectId(memberId),
        journeyId: generateObjectId(journeyId),
      });
      spyOnServiceGetTodo.mockImplementationOnce(async () => todo);
      spyOnServiceEndTodo.mockImplementationOnce(async () => true);
      spyOnJourneyServiceGetRecent.mockResolvedValue({ id: journeyId });

      const result = await resolver.endTodo(memberId, [MemberRole.member], id);

      expect(spyOnServiceEndTodo).toHaveBeenCalledWith(id, memberId);
      expect(spyOnServiceGetTodo).toHaveBeenCalledWith(id, memberId, journeyId);
      expect(result).toBeTruthy();
    });

    it('should end Todo by user', async () => {
      const userId = generateId();
      const memberId = generateId();
      const journeyId = generateId();
      const id = generateId();
      const todo = mockGenerateTodo({ id, memberId: generateObjectId(memberId) });
      spyOnServiceGetTodo.mockImplementationOnce(async () => todo);
      spyOnServiceEndTodo.mockImplementationOnce(async () => todo);
      spyOnJourneyServiceGetRecent.mockResolvedValue({ id: journeyId });

      const result = await resolver.endTodo(userId, [UserRole.lagunaCoach], id);

      expect(spyOnServiceGetTodo).not.toHaveBeenCalled();
      expect(spyOnServiceEndTodo).toHaveBeenCalledWith(id, userId);
      expect(result).toBeTruthy();
    });

    it('should fail to end todo by member if action todo', async () => {
      const memberId = generateId();
      const journeyId = generateId();
      const id = generateId();
      const actionTodo = mockGenerateActionTodo({ id, memberId: generateObjectId(memberId) });
      spyOnServiceGetTodo.mockImplementationOnce(async () => actionTodo);
      spyOnServiceEndTodo.mockImplementationOnce(async () => actionTodo);
      spyOnJourneyServiceGetRecent.mockResolvedValue({ id: journeyId });

      await expect(resolver.endTodo(memberId, [MemberRole.member], id)).rejects.toThrow(
        Errors.get(ErrorType.todoEndActionTodo),
      );
    });

    [(UserRole.lagunaCoach, UserRole.lagunaNurse, UserRole.lagunaAdmin)].forEach((role) => {
      test.each([TodoLabel.Meds, TodoLabel.Appointment, undefined])(
        `should end a Todo by ${role} and send notification to member with label = %p`,
        async (label) => {
          const userId = generateId();
          const memberId = generateId();
          const journeyId = generateId();
          const id = generateId();
          const todo = mockGenerateTodo({ id, memberId: generateObjectId(memberId), label });
          spyOnServiceGetTodo.mockImplementationOnce(async () => todo);
          spyOnServiceEndTodo.mockImplementationOnce(async () => todo);
          spyOnJourneyServiceGetRecent.mockResolvedValue({ id: journeyId });

          await resolver.endTodo(userId, [role], id);

          const contentKey = TodoInternalKey[`deleteTodo${todo.label ? todo.label : 'Todo'}`];
          expect(spyOnEventEmitter).toBeCalledWith(EventType.notifyDispatch, {
            correlationId: expect.any(String),
            dispatchId: generateDispatchId(contentKey, todo.memberId.toString(), todo.id),
            notificationType: NotificationType.text,
            recipientClientId: todo.memberId.toString(),
            senderClientId: userId,
            contentKey,
            path: 'todo',
          });
        },
      );
    });
  });

  describe('approveTodo', () => {
    let spyOnServiceApproveTodo;
    let spyOnJourneyServiceGetRecent;

    beforeEach(() => {
      spyOnServiceApproveTodo = jest.spyOn(service, 'approveTodo');
      spyOnJourneyServiceGetRecent = jest.spyOn(journeyService, 'getRecent');
    });

    afterEach(() => {
      spyOnServiceApproveTodo.mockReset();
      spyOnJourneyServiceGetRecent.mockReset();
    });

    it('should approve Todo', async () => {
      const memberId = generateId();
      const journeyId = generateId();
      const id = generateId();
      spyOnServiceApproveTodo.mockImplementationOnce(async () => true);
      spyOnJourneyServiceGetRecent.mockResolvedValue({ id: journeyId });

      const result = await resolver.approveTodo([MemberRole.member], memberId, id);

      expect(spyOnServiceApproveTodo).toHaveBeenCalledWith(id, memberId, journeyId);
      expect(result).toBeTruthy();
    });

    test.each([UserRole.lagunaCoach, UserRole.lagunaNurse, UserRole.lagunaAdmin])(
      'should throw an error on approve todo if role = %p',
      async (role) => {
        await expect(resolver.approveTodo([role], generateId(), generateId())).rejects.toThrow(
          Error(Errors.get(ErrorType.memberAllowedOnly)),
        );
      },
    );
  });

  describe('createTodoDone', () => {
    let spyOnServiceCreateTodoDone;
    let spyOnServiceEndTodo;
    let spyOnJourneyServiceGetRecent;

    beforeEach(() => {
      spyOnServiceCreateTodoDone = jest.spyOn(service, 'createTodoDone');
      spyOnServiceEndTodo = jest.spyOn(service, 'endTodo');
      spyOnJourneyServiceGetRecent = jest.spyOn(journeyService, 'getRecent');
    });

    afterEach(() => {
      spyOnServiceCreateTodoDone.mockReset();
      spyOnServiceEndTodo.mockReset();
      spyOnJourneyServiceGetRecent.mockReset();
    });

    it('should create TodoDone', async () => {
      const id = generateId();
      const journeyId = generateId();
      const params: CreateTodoDoneParams = generateCreateTodoDoneParams();
      spyOnServiceCreateTodoDone.mockImplementationOnce(async () => id);
      spyOnServiceEndTodo.mockImplementationOnce(async () => true);
      spyOnJourneyServiceGetRecent.mockResolvedValue({ id: journeyId });

      const result = await resolver.createTodoDone([MemberRole.member], params);

      expect(result).toEqual(id);
      expect(spyOnServiceCreateTodoDone).toHaveBeenCalledWith({ ...params, journeyId });
      expect(spyOnServiceEndTodo).not.toHaveBeenCalled();
    });

    test.each([UserRole.lagunaCoach, UserRole.lagunaNurse, UserRole.lagunaAdmin])(
      'should throw an error on create TodoDone if role = %p',
      async (role) => {
        await expect(
          resolver.createTodoDone([role], generateCreateTodoDoneParams()),
        ).rejects.toThrow(Error(Errors.get(ErrorType.memberAllowedOnly)));
      },
    );
  });

  describe('getTodoDones', () => {
    let spyOnServiceGetTodoDones;
    let spyOnJourneyServiceGetRecent;

    beforeEach(() => {
      spyOnServiceGetTodoDones = jest.spyOn(service, 'getTodoDones');
      spyOnJourneyServiceGetRecent = jest.spyOn(journeyService, 'getRecent');
    });

    afterEach(() => {
      spyOnServiceGetTodoDones.mockReset();
      spyOnJourneyServiceGetRecent.mockReset();
    });

    it('should get Todos by member', async () => {
      const memberId = generateId();
      const journeyId = generateId();
      const todoId = generateId();
      const todoDones = [
        mockGenerateTodoDone({
          memberId: generateObjectId(memberId),
          journeyId: generateObjectId(journeyId),
          todoId: generateObjectId(todoId),
        }),
        mockGenerateTodoDone({
          memberId: generateObjectId(memberId),
          journeyId: generateObjectId(journeyId),
          todoId: generateObjectId(todoId),
        }),
      ];
      const getTodoDonesParams = generateGetTodoDonesParams({ memberId });
      spyOnServiceGetTodoDones.mockImplementationOnce(async () => todoDones);
      spyOnJourneyServiceGetRecent.mockResolvedValue({ id: journeyId });

      const result = await resolver.getTodoDones(getTodoDonesParams);

      expect(spyOnServiceGetTodoDones).toHaveBeenCalledWith({ ...getTodoDonesParams, journeyId });
      expect(result).toEqual(todoDones);
    });
  });

  describe('deleteTodoDone', () => {
    let spyOnServiceDeleteTodoDone;
    let spyOnJourneyServiceGetRecent;

    beforeEach(() => {
      spyOnServiceDeleteTodoDone = jest.spyOn(service, 'deleteTodoDone');
      spyOnJourneyServiceGetRecent = jest.spyOn(journeyService, 'getRecent');
    });

    afterEach(() => {
      spyOnServiceDeleteTodoDone.mockReset();
      spyOnJourneyServiceGetRecent.mockReset();
    });

    it('should delete TodoDone', async () => {
      const memberId = generateId();
      const journeyId = generateId();
      const id = generateId();
      spyOnServiceDeleteTodoDone.mockImplementationOnce(async () => true);
      spyOnJourneyServiceGetRecent.mockResolvedValue({ id: journeyId });

      const result = await resolver.deleteTodoDone([MemberRole.member], memberId, id);

      expect(spyOnServiceDeleteTodoDone).toHaveBeenCalledWith(id, memberId, journeyId);
      expect(result).toBeTruthy();
    });

    test.each([UserRole.lagunaCoach, UserRole.lagunaNurse, UserRole.lagunaAdmin])(
      'should throw an error on delete todoDone if role = %p',
      async (role) => {
        await expect(resolver.deleteTodoDone([role], generateId(), generateId())).rejects.toThrow(
          Error(Errors.get(ErrorType.memberAllowedOnly)),
        );
      },
    );
  });
});
