import { mockLogger, mockProcessWarnings } from '@lagunahealth/pandora';
import { Test, TestingModule } from '@nestjs/testing';
import { LoggerService } from '../../src/common';
import {
  dbDisconnect,
  defaultModules,
  generateCreateTodoParams,
  generateDeleteTodoParams,
  generateEndAndCreateTodoParams,
  generateId,
  generateObjectId,
  mockGenerateMember,
  mockGenerateTodo,
  mockGenerateUser,
} from '../index';
import {
  CreateTodoParams,
  DeleteTodoParams,
  EndAndCreateTodoParams,
  TodoModule,
  TodoResolver,
  TodoService,
} from '../../src/todo';

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
    let spyOnServiceCreate;

    beforeEach(() => {
      spyOnServiceCreate = jest.spyOn(service, 'createTodo');
    });

    afterEach(() => {
      spyOnServiceCreate.mockReset();
    });

    it('should create a Todo by member', async () => {
      const member = mockGenerateMember();
      const memberId = member.id;
      const id = generateId();
      spyOnServiceCreate.mockImplementationOnce(async () => id);
      const params: CreateTodoParams = generateCreateTodoParams();

      const result = await resolver.createTodo(memberId, params);

      params.createdBy = memberId;
      params.updatedBy = memberId;

      expect(spyOnServiceCreate).toHaveBeenCalledWith(params);
      expect(result).toEqual(id);
    });

    it('should create a Todo by user', async () => {
      const member = mockGenerateMember();
      const memberId = member.id;
      const user = mockGenerateUser();
      const userId = user.id;
      const id = generateId();
      spyOnServiceCreate.mockImplementationOnce(async () => id);
      const params: CreateTodoParams = generateCreateTodoParams({ memberId });

      const result = await resolver.createTodo(userId, params);

      params.createdBy = userId;
      params.updatedBy = userId;

      expect(spyOnServiceCreate).toHaveBeenCalledWith(params);
      expect(result).toEqual(id);
    });
  });

  describe('getTodos', () => {
    let spyOnServiceGet;

    beforeEach(() => {
      spyOnServiceGet = jest.spyOn(service, 'getTodos');
    });

    afterEach(() => {
      spyOnServiceGet.mockReset();
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
      spyOnServiceGet.mockImplementationOnce(async () => todos);

      const result = await resolver.getTodos(memberId);

      expect(spyOnServiceGet).toHaveBeenCalledWith(memberId);
      expect(result).toEqual(todos);
    });
  });

  describe('endAndCreateTodo', () => {
    let spyOnServiceUpdate;

    beforeEach(() => {
      spyOnServiceUpdate = jest.spyOn(service, 'endAndCreateTodo');
    });

    afterEach(() => {
      spyOnServiceUpdate.mockReset();
    });

    it('should update Todo by member', async () => {
      const member = mockGenerateMember();
      const memberId = member.id;
      const newTodo = mockGenerateTodo({
        memberId: generateObjectId(memberId),
        createdBy: generateObjectId(memberId),
        updatedBy: generateObjectId(memberId),
      });
      spyOnServiceUpdate.mockImplementationOnce(async () => newTodo);
      const params: EndAndCreateTodoParams = generateEndAndCreateTodoParams();

      const result = await resolver.endAndCreateTodo(memberId, params);

      params.updatedBy = memberId;

      expect(spyOnServiceUpdate).toHaveBeenCalledWith(params);
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
      spyOnServiceUpdate.mockImplementationOnce(async () => newTodo);
      const params: EndAndCreateTodoParams = generateEndAndCreateTodoParams({ memberId });

      const result = await resolver.endAndCreateTodo(userId, params);

      params.updatedBy = userId;

      expect(spyOnServiceUpdate).toHaveBeenCalledWith(params);
      expect(result).toEqual(newTodo);
    });
  });

  describe('deleteTodo', () => {
    let spyOnServiceDelete;

    beforeEach(() => {
      spyOnServiceDelete = jest.spyOn(service, 'deleteTodo');
    });

    afterEach(() => {
      spyOnServiceDelete.mockReset();
    });

    it('should delete Todo by member', async () => {
      const member = mockGenerateMember();
      const memberId = member.id;

      spyOnServiceDelete.mockImplementationOnce(async () => true);
      const params: DeleteTodoParams = generateDeleteTodoParams();

      const result = await resolver.deleteTodo(memberId, params);

      params.deletedBy = memberId;

      expect(spyOnServiceDelete).toHaveBeenCalledWith(params);
      expect(result).toBeTruthy();
    });

    it('should delete Todo by user', async () => {
      const member = mockGenerateMember();
      const memberId = member.id;
      const user = mockGenerateUser();
      const userId = user.id;

      spyOnServiceDelete.mockImplementationOnce(async () => true);
      const params: DeleteTodoParams = generateDeleteTodoParams({ memberId });

      const result = await resolver.deleteTodo(userId, params);

      params.deletedBy = userId;

      expect(spyOnServiceDelete).toHaveBeenCalledWith(params);
      expect(result).toBeTruthy();
    });
  });
});
