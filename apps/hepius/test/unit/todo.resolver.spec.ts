import {
  NotificationType,
  TodoInternalKey,
  generateDispatchId,
  mockLogger,
  mockProcessWarnings,
} from '@argus/pandora';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Test, TestingModule } from '@nestjs/testing';
import {
  ErrorType,
  Errors,
  EventType,
  LoggerService,
  MemberRole,
  UserRole,
} from '../../src/common';
import {
  CreateTodoDoneParams,
  CreateTodoParams,
  TodoLabel,
  TodoModule,
  TodoResolver,
  TodoService,
  TodoStatus,
  UpdateTodoParams,
} from '../../src/todo';
import {
  dbDisconnect,
  defaultModules,
  generateCreateTodoDoneParams,
  generateCreateTodoParams,
  generateGetTodoDonesParams,
  generateId,
  generateObjectId,
  generateUpdateTodoParams,
  mockGenerateActionTodo,
  mockGenerateMember,
  mockGenerateTodo,
  mockGenerateTodoDone,
} from '../index';

describe('TodoResolver', () => {
  let module: TestingModule;
  let resolver: TodoResolver;
  let service: TodoService;
  let eventEmitter: EventEmitter2;
  let spyOnEventEmitter;

  beforeAll(async () => {
    mockProcessWarnings(); // to hide pino prettyPrint warning
    module = await Test.createTestingModule({
      imports: defaultModules().concat(TodoModule),
    }).compile();

    resolver = module.get<TodoResolver>(TodoResolver);
    service = module.get<TodoService>(TodoService);
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

    beforeEach(() => {
      spyOnServiceCreateTodo = jest.spyOn(service, 'createTodo');
    });

    afterEach(() => {
      spyOnServiceCreateTodo.mockReset();
      spyOnEventEmitter.mockReset();
    });

    it('should create a Todo by member', async () => {
      const memberId = generateId();
      const todo = mockGenerateTodo({ memberId: generateObjectId(memberId) });
      spyOnServiceCreateTodo.mockImplementationOnce(async () => todo);
      const params: CreateTodoParams = generateCreateTodoParams();

      const result = await resolver.createTodo([MemberRole.member], memberId, params);

      expect(spyOnServiceCreateTodo).toHaveBeenCalledWith({ ...params, status: TodoStatus.active });
      expect(result).toEqual({ id: todo.id });
    });

    test.each([UserRole.coach, UserRole.nurse])('should create a Todo by user', async (role) => {
      const memberId = generateId();
      const userId = generateId();
      const todo = mockGenerateTodo({ memberId: generateObjectId(memberId) });
      spyOnServiceCreateTodo.mockImplementationOnce(async () => todo);
      const params: CreateTodoParams = generateCreateTodoParams({ memberId });
      delete params.label;

      const result = await resolver.createTodo([role], userId, params);

      expect(spyOnServiceCreateTodo).toHaveBeenCalledWith({
        ...params,
        status: TodoStatus.active,
      });
      expect(result).toEqual({ id: todo.id });
    });

    [UserRole.coach, UserRole.nurse, UserRole.admin].forEach((role) => {
      test.each([TodoLabel.Meds, TodoLabel.Appointment, undefined])(
        `should create a Todo by ${role} and send notification to member`,
        async (label) => {
          const memberId = generateId();
          const userId = generateId();
          const todo = mockGenerateTodo({ memberId: generateObjectId(memberId), label });
          spyOnServiceCreateTodo.mockImplementationOnce(async () => todo);
          const params: CreateTodoParams = generateCreateTodoParams({ memberId });
          delete params.label;

          const result = await resolver.createTodo([role], userId, params);

          expect(spyOnServiceCreateTodo).toHaveBeenCalledWith({
            ...params,
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

    test.each([UserRole.coach, UserRole.nurse, UserRole.admin])(
      `should create a Todo by user in status requested if label ${TodoLabel.Meds}`,
      async (role) => {
        const memberId = generateId();
        const userId = generateId();
        const todo = mockGenerateTodo({ memberId: generateObjectId(memberId) });
        spyOnServiceCreateTodo.mockImplementationOnce(async () => todo);
        const params: CreateTodoParams = generateCreateTodoParams({
          memberId,
          label: TodoLabel.Meds,
        });
        params.label = TodoLabel.Meds;

        const result = await resolver.createTodo([role], userId, params);

        expect(spyOnServiceCreateTodo).toHaveBeenCalledWith({
          ...params,
          status: TodoStatus.requested,
        });
        expect(result).toEqual({ id: todo.id });
      },
    );
  });

  describe('getTodos', () => {
    let spyOnServiceGetTodos;

    beforeEach(() => {
      spyOnServiceGetTodos = jest.spyOn(service, 'getTodos');
    });

    afterEach(() => {
      spyOnServiceGetTodos.mockReset();
    });

    it('should get Todos by member', async () => {
      const member = mockGenerateMember();
      const memberId = member.id;
      const todos = [
        mockGenerateTodo({
          memberId: generateObjectId(memberId),
          createdBy: generateObjectId(memberId),
          updatedBy: generateObjectId(memberId),
        }),
        mockGenerateTodo({
          memberId: generateObjectId(memberId),
          createdBy: generateObjectId(memberId),
          updatedBy: generateObjectId(memberId),
        }),
      ];
      spyOnServiceGetTodos.mockImplementationOnce(async () => todos);

      const result = await resolver.getTodos(memberId);

      expect(spyOnServiceGetTodos).toHaveBeenCalledWith(memberId);
      expect(result).toEqual(todos);
    });
  });

  describe('updateTodo', () => {
    let spyOnServiceUpdateTodo;

    beforeEach(() => {
      spyOnServiceUpdateTodo = jest.spyOn(service, 'updateTodo');
    });

    afterEach(() => {
      spyOnServiceUpdateTodo.mockReset();
      spyOnEventEmitter.mockReset();
    });

    it('should update Todo by member', async () => {
      const member = mockGenerateMember();
      const memberId = member.id;
      const newTodo = mockGenerateTodo({
        memberId: generateObjectId(memberId),
        createdBy: generateObjectId(memberId),
        updatedBy: generateObjectId(memberId),
      });
      spyOnServiceUpdateTodo.mockImplementationOnce(async () => newTodo);
      const params: UpdateTodoParams = generateUpdateTodoParams();

      const result = await resolver.updateTodo([MemberRole.member], memberId, params);

      expect(spyOnServiceUpdateTodo).toHaveBeenCalledWith({
        ...params,
        status: TodoStatus.active,
      });
      expect(result).toEqual(newTodo);
    });

    test.each([UserRole.coach, UserRole.nurse])('should update Todo by user', async (role) => {
      const memberId = generateId();
      const userId = generateId();
      const newTodo = mockGenerateTodo({
        memberId: generateObjectId(memberId),
        createdBy: generateObjectId(memberId),
        updatedBy: generateObjectId(memberId),
      });
      spyOnServiceUpdateTodo.mockImplementationOnce(async () => newTodo);
      const params: UpdateTodoParams = generateUpdateTodoParams({ memberId });
      delete params.label;

      const result = await resolver.updateTodo([role], userId, params);

      expect(spyOnServiceUpdateTodo).toHaveBeenCalledWith({
        ...params,
        status: TodoStatus.active,
      });
      expect(result).toEqual(newTodo);
    });

    [UserRole.coach, UserRole.nurse, UserRole.admin].forEach((role) => {
      test.each([TodoLabel.Meds, TodoLabel.Appointment, undefined])(
        `should update a Todo by ${role} and send notification to member with label = %p`,
        async (label) => {
          const memberId = generateId();
          const userId = generateId();
          const newTodo = mockGenerateTodo({
            memberId: generateObjectId(memberId),
            createdBy: generateObjectId(memberId),
            updatedBy: generateObjectId(memberId),
            label,
          });
          spyOnServiceUpdateTodo.mockImplementationOnce(async () => newTodo);
          const params: UpdateTodoParams = generateUpdateTodoParams({ memberId });

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

    test.each([UserRole.coach, UserRole.nurse, UserRole.admin])(
      `should update Todo by user in status requested if label ${TodoLabel.Meds}`,
      async (role) => {
        const memberId = generateId();
        const userId = generateId();
        const newTodo = mockGenerateTodo({
          memberId: generateObjectId(memberId),
        });
        spyOnServiceUpdateTodo.mockImplementationOnce(async () => newTodo);
        const params: UpdateTodoParams = generateUpdateTodoParams({
          memberId,
          label: TodoLabel.Meds,
        });

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

    beforeEach(() => {
      spyOnServiceGetTodo = jest.spyOn(service, 'getTodo');
      spyOnServiceEndTodo = jest.spyOn(service, 'endTodo');
    });

    afterEach(() => {
      spyOnServiceGetTodo.mockReset();
      spyOnServiceEndTodo.mockReset();
      spyOnEventEmitter.mockReset();
    });

    it('should end Todo by member', async () => {
      const memberId = generateId();
      const id = generateId();
      const todo = mockGenerateTodo({ id, memberId: generateObjectId(memberId) });

      spyOnServiceGetTodo.mockImplementationOnce(async () => todo);
      spyOnServiceEndTodo.mockImplementationOnce(async () => true);

      const result = await resolver.endTodo(memberId, [MemberRole.member], id);

      expect(spyOnServiceEndTodo).toHaveBeenCalledWith(id, memberId);
      expect(spyOnServiceGetTodo).toHaveBeenCalledWith(id, memberId);
      expect(result).toBeTruthy();
    });

    it('should end Todo by user', async () => {
      const userId = generateId();
      const memberId = generateId();
      const id = generateId();
      const todo = mockGenerateTodo({ id, memberId: generateObjectId(memberId) });

      spyOnServiceGetTodo.mockImplementationOnce(async () => todo);
      spyOnServiceEndTodo.mockImplementationOnce(async () => todo);

      const result = await resolver.endTodo(userId, [UserRole.coach], id);

      expect(spyOnServiceGetTodo).not.toHaveBeenCalled();
      expect(spyOnServiceEndTodo).toHaveBeenCalledWith(id, userId);
      expect(result).toBeTruthy();
    });

    it('should fail to end todo by member if action todo', async () => {
      const memberId = generateId();
      const id = generateId();
      const actionTodo = mockGenerateActionTodo({ id, memberId: generateObjectId(memberId) });

      spyOnServiceGetTodo.mockImplementationOnce(async () => actionTodo);
      spyOnServiceEndTodo.mockImplementationOnce(async () => actionTodo);

      await expect(resolver.endTodo(memberId, [MemberRole.member], id)).rejects.toThrow(
        Errors.get(ErrorType.todoEndActionTodo),
      );
    });

    [(UserRole.coach, UserRole.nurse, UserRole.admin)].forEach((role) => {
      test.each([TodoLabel.Meds, TodoLabel.Appointment, undefined])(
        `should end a Todo by ${role} and send notification to member with label = %p`,
        async (label) => {
          const userId = generateId();
          const memberId = generateId();
          const id = generateId();
          const todo = mockGenerateTodo({ id, memberId: generateObjectId(memberId), label });
          spyOnServiceGetTodo.mockImplementationOnce(async () => todo);
          spyOnServiceEndTodo.mockImplementationOnce(async () => todo);

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

    beforeEach(() => {
      spyOnServiceApproveTodo = jest.spyOn(service, 'approveTodo');
    });

    afterEach(() => {
      spyOnServiceApproveTodo.mockReset();
    });

    it('should approve Todo', async () => {
      const memberId = generateId();
      const id = generateId();

      spyOnServiceApproveTodo.mockImplementationOnce(async () => true);

      const result = await resolver.approveTodo([MemberRole.member], memberId, id);

      expect(spyOnServiceApproveTodo).toHaveBeenCalledWith(id, memberId);
      expect(result).toBeTruthy();
    });

    test.each([UserRole.coach, UserRole.nurse, UserRole.admin])(
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

    beforeEach(() => {
      spyOnServiceCreateTodoDone = jest.spyOn(service, 'createTodoDone');
      spyOnServiceEndTodo = jest.spyOn(service, 'endTodo');
    });

    afterEach(() => {
      spyOnServiceCreateTodoDone.mockReset();
      spyOnServiceEndTodo.mockReset();
    });

    it('should create TodoDone', async () => {
      const id = generateId();

      spyOnServiceCreateTodoDone.mockImplementationOnce(async () => id);
      spyOnServiceEndTodo.mockImplementationOnce(async () => true);

      const params: CreateTodoDoneParams = generateCreateTodoDoneParams();

      const result = await resolver.createTodoDone([MemberRole.member], params);

      expect(result).toEqual(id);
      expect(spyOnServiceCreateTodoDone).toHaveBeenCalledWith(params);
      expect(spyOnServiceEndTodo).not.toHaveBeenCalled();
    });

    test.each([UserRole.coach, UserRole.nurse, UserRole.admin])(
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

    beforeEach(() => {
      spyOnServiceGetTodoDones = jest.spyOn(service, 'getTodoDones');
    });

    afterEach(() => {
      spyOnServiceGetTodoDones.mockReset();
    });

    it('should get Todos by member', async () => {
      const memberId = generateId();
      const todoId = generateId();
      const todoDones = [
        mockGenerateTodoDone({
          memberId: generateObjectId(memberId),
          todoId: generateObjectId(todoId),
        }),
        mockGenerateTodoDone({
          memberId: generateObjectId(memberId),
          todoId: generateObjectId(todoId),
        }),
      ];
      spyOnServiceGetTodoDones.mockImplementationOnce(async () => todoDones);

      const getTodoDonesParams = generateGetTodoDonesParams({ memberId });
      const result = await resolver.getTodoDones(getTodoDonesParams);

      expect(spyOnServiceGetTodoDones).toHaveBeenCalledWith(getTodoDonesParams);
      expect(result).toEqual(todoDones);
    });
  });

  describe('deleteTodoDone', () => {
    let spyOnServiceDeleteTodoDone;

    beforeEach(() => {
      spyOnServiceDeleteTodoDone = jest.spyOn(service, 'deleteTodoDone');
    });

    afterEach(() => {
      spyOnServiceDeleteTodoDone.mockReset();
    });

    it('should delete TodoDone', async () => {
      const memberId = generateId();
      const id = generateId();

      spyOnServiceDeleteTodoDone.mockImplementationOnce(async () => true);

      const result = await resolver.deleteTodoDone([MemberRole.member], memberId, id);

      expect(spyOnServiceDeleteTodoDone).toHaveBeenCalledWith(id, memberId);
      expect(result).toBeTruthy();
    });

    test.each([UserRole.coach, UserRole.nurse, UserRole.admin])(
      'should throw an error on delete todoDone if role = %p',
      async (role) => {
        await expect(resolver.deleteTodoDone([role], generateId(), generateId())).rejects.toThrow(
          Error(Errors.get(ErrorType.memberAllowedOnly)),
        );
      },
    );
  });
});
