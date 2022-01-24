import { mockLogger, mockProcessWarnings } from '@lagunahealth/pandora';
import { Test, TestingModule } from '@nestjs/testing';
import { ErrorType, Errors, LoggerService, MemberRole, UserRole } from '../../src/common';
import {
  CreateTodoDoneParams,
  CreateTodoParams,
  EndAndCreateTodoParams,
  TodoModule,
  TodoResolver,
  TodoService,
} from '../../src/todo';
import {
  dbDisconnect,
  defaultModules,
  generateCreateTodoDoneParams,
  generateCreateTodoParams,
  generateEndAndCreateTodoParams,
  generateId,
  generateObjectId,
  mockGenerateMember,
  mockGenerateTodo,
  mockGenerateTodoDone,
  mockGenerateUser,
} from '../index';

describe('TodoResolver', () => {
  let module: TestingModule;
  let resolver: TodoResolver;
  let service: TodoService;

  beforeAll(async () => {
    mockProcessWarnings(); // to hide pino prettyPrint warning
    module = await Test.createTestingModule({
      imports: defaultModules().concat(TodoModule),
    }).compile();

    resolver = module.get<TodoResolver>(TodoResolver);
    service = module.get<TodoService>(TodoService);
    mockLogger(module.get<LoggerService>(LoggerService));
  });

  afterAll(async () => {
    await module.close();
    await dbDisconnect();
  });

  describe('createTodo', () => {
    let spyOnServiceCreateTodo;

    beforeEach(() => {
      spyOnServiceCreateTodo = jest.spyOn(service, 'createTodo');
    });

    afterEach(() => {
      spyOnServiceCreateTodo.mockReset();
    });

    it('should create a Todo by member', async () => {
      const member = mockGenerateMember();
      const memberId = member.id;
      const id = generateId();
      spyOnServiceCreateTodo.mockImplementationOnce(async () => id);
      const params: CreateTodoParams = generateCreateTodoParams();

      const result = await resolver.createTodo(memberId, params);

      params.createdBy = memberId;
      params.updatedBy = memberId;

      expect(spyOnServiceCreateTodo).toHaveBeenCalledWith(params);
      expect(result).toEqual(id);
    });

    it('should create a Todo by user', async () => {
      const member = mockGenerateMember();
      const memberId = member.id;
      const user = mockGenerateUser();
      const userId = user.id;
      const id = generateId();
      spyOnServiceCreateTodo.mockImplementationOnce(async () => id);
      const params: CreateTodoParams = generateCreateTodoParams({ memberId });

      const result = await resolver.createTodo(userId, params);

      params.createdBy = userId;
      params.updatedBy = userId;

      expect(spyOnServiceCreateTodo).toHaveBeenCalledWith(params);
      expect(result).toEqual(id);
    });
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

  describe('endAndCreateTodo', () => {
    let spyOnServiceUpdateTodo;

    beforeEach(() => {
      spyOnServiceUpdateTodo = jest.spyOn(service, 'endAndCreateTodo');
    });

    afterEach(() => {
      spyOnServiceUpdateTodo.mockReset();
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
      const params: EndAndCreateTodoParams = generateEndAndCreateTodoParams();

      const result = await resolver.endAndCreateTodo(memberId, params);

      params.updatedBy = memberId;

      expect(spyOnServiceUpdateTodo).toHaveBeenCalledWith(params);
      expect(result).toEqual(newTodo);
    });

    it('should update Todo by user', async () => {
      const member = mockGenerateMember();
      const memberId = member.id;
      const user = mockGenerateUser();
      const userId = user.id;
      const newTodo = mockGenerateTodo({
        memberId: generateObjectId(memberId),
        createdBy: generateObjectId(memberId),
        updatedBy: generateObjectId(memberId),
      });
      spyOnServiceUpdateTodo.mockImplementationOnce(async () => newTodo);
      const params: EndAndCreateTodoParams = generateEndAndCreateTodoParams({ memberId });

      const result = await resolver.endAndCreateTodo(userId, params);

      params.updatedBy = userId;

      expect(spyOnServiceUpdateTodo).toHaveBeenCalledWith(params);
      expect(result).toEqual(newTodo);
    });
  });

  describe('deleteTodo', () => {
    let spyOnServiceGetTodo;
    let spyOnServiceEndTodo;

    beforeEach(() => {
      spyOnServiceGetTodo = jest.spyOn(service, 'getTodo');
      spyOnServiceEndTodo = jest.spyOn(service, 'endTodo');
    });

    afterEach(() => {
      spyOnServiceGetTodo.mockReset();
      spyOnServiceEndTodo.mockReset();
    });

    it('should delete Todo by member', async () => {
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

    it('should delete Todo by user', async () => {
      const userId = generateId();
      const memberId = generateId();
      const id = generateId();
      const todo = mockGenerateTodo({ id, memberId: generateObjectId(memberId) });

      spyOnServiceGetTodo.mockImplementationOnce(async () => todo);
      spyOnServiceEndTodo.mockImplementationOnce(async () => true);

      const result = await resolver.endTodo(userId, [UserRole.coach], id);

      expect(spyOnServiceGetTodo).not.toHaveBeenCalled();
      expect(spyOnServiceEndTodo).toHaveBeenCalledWith(id, userId);
      expect(result).toBeTruthy();
    });
  });

  describe('createTodoDone', () => {
    let spyOnServiceGetTodo;
    let spyOnServiceCreateTodoDone;

    beforeEach(() => {
      spyOnServiceGetTodo = jest.spyOn(service, 'getTodo');
      spyOnServiceCreateTodoDone = jest.spyOn(service, 'createTodoDone');
    });

    afterEach(() => {
      spyOnServiceGetTodo.mockReset();
      spyOnServiceCreateTodoDone.mockReset();
    });

    it('should create TodoDone', async () => {
      const id = generateId();
      const todo = mockGenerateTodo();

      spyOnServiceGetTodo.mockImplementationOnce(async () => todo);
      spyOnServiceCreateTodoDone.mockImplementationOnce(async () => id);
      const params: CreateTodoDoneParams = generateCreateTodoDoneParams();
      const { todoId, memberId } = params;

      const result = await resolver.createTodoDone([MemberRole.member], params);

      expect(result).toEqual(id);
      expect(spyOnServiceGetTodo).toHaveBeenCalledWith(todoId, memberId);
      expect(spyOnServiceCreateTodoDone).toHaveBeenCalledWith(params);
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

      const result = await resolver.getTodoDones(memberId);

      expect(spyOnServiceGetTodoDones).toHaveBeenCalledWith(memberId);
      expect(result).toEqual(todoDones);
    });
  });
});
