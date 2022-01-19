import { mockLogger, mockProcessWarnings } from '@lagunahealth/pandora';
import { Test, TestingModule } from '@nestjs/testing';
import { cloneDeep } from 'lodash';
import { Model, model } from 'mongoose';
import { ErrorType, Errors, LoggerService } from '../../src/common';
import {
  CreateTodoParams,
  DeleteTodoParams,
  EndAndCreateTodoParams,
  Todo,
  TodoDto,
  TodoModule,
  TodoService,
  TodoStatus,
} from '../../src/todo';
import {
  dbConnect,
  dbDisconnect,
  defaultModules,
  generateCreateTodoParams,
  generateDeleteTodoParams,
  generateEndAndCreateTodoParams,
  generateId,
  generateObjectId,
} from '../index';

describe('TodoService', () => {
  let module: TestingModule;
  let service: TodoService;
  let todoModel: Model<typeof TodoDto>;

  beforeAll(async () => {
    mockProcessWarnings(); // to hide pino prettyPrint warning
    module = await Test.createTestingModule({
      imports: defaultModules().concat(TodoModule),
    }).compile();

    service = module.get<TodoService>(TodoService);
    mockLogger(module.get<LoggerService>(LoggerService));

    todoModel = model(Todo.name, TodoDto);

    await dbConnect();
  });

  afterAll(async () => {
    await module.close();
    await dbDisconnect();
  });

  describe('createTodo', () => {
    it('should create todo', async () => {
      const memberId = generateId();

      const params: CreateTodoParams = generateCreateTodoParams({
        memberId,
        createdBy: memberId,
        updatedBy: memberId,
      });

      const { id } = await service.createTodo(params);
      expect(id).not.toBeUndefined();

      const createdTodo = await todoModel.findById(id).lean();
      expect(createdTodo).toEqual(
        expect.objectContaining({
          ...params,
          _id: id,
          memberId: generateObjectId(memberId),
          status: TodoStatus.active,
          createdBy: generateObjectId(memberId),
          updatedBy: generateObjectId(memberId),
          createdAt: expect.any(Date),
          updatedAt: expect.any(Date),
        }),
      );
    });
  });

  describe('getTodos', () => {
    it('should get todos', async () => {
      const memberId = generateId();
      const userId = generateId();

      const params1: CreateTodoParams = generateCreateTodoParams({
        memberId,
        createdBy: memberId,
        updatedBy: memberId,
      });

      const params2: CreateTodoParams = generateCreateTodoParams({
        memberId,
        createdBy: userId,
        updatedBy: userId,
      });

      const { id: id1 } = await service.createTodo(params1);
      const { id: id2 } = await service.createTodo(params2);

      const createdTodos = await service.getTodos(memberId);

      expect(createdTodos).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            _id: id1,
            memberId: generateObjectId(memberId),
            text: params1.text,
            label: params1.label,
            cronExpressions: expect.arrayContaining([...params1.cronExpressions]),
            start: params1.start,
            end: params1.end,
            status: TodoStatus.active,
            createdBy: generateObjectId(memberId),
            updatedBy: generateObjectId(memberId),
            createdAt: expect.any(Date),
            updatedAt: expect.any(Date),
          }),
          expect.objectContaining({
            _id: id2,
            memberId: generateObjectId(memberId),
            text: params2.text,
            label: params2.label,
            cronExpressions: expect.arrayContaining([...params2.cronExpressions]),
            start: params2.start,
            end: params2.end,
            status: TodoStatus.active,
            createdBy: generateObjectId(userId),
            updatedBy: generateObjectId(userId),
            createdAt: expect.any(Date),
            updatedAt: expect.any(Date),
          }),
        ]),
      );
    });

    it('should get empty array if member doesnt have todos', async () => {
      const createdTodos = await service.getTodos(generateId());
      expect(createdTodos).toEqual([]);
    });
  });

  describe('endAndCreateTodo', () => {
    it('should update Todo', async () => {
      const memberId = generateId();
      const userId = generateId();

      const createParams: CreateTodoParams = generateCreateTodoParams({
        memberId,
        createdBy: memberId,
        updatedBy: memberId,
      });

      const { id } = await service.createTodo(createParams);

      const updateParams: EndAndCreateTodoParams = generateEndAndCreateTodoParams({
        id,
        memberId,
        updatedBy: userId,
      });
      const updateParamsWithNoId = cloneDeep(updateParams);
      delete updateParamsWithNoId.id;

      const endedTodo = await service.endAndCreateTodo(updateParams);
      const oldTodo = await todoModel.findById(id).lean();
      delete createParams.end;

      expect(oldTodo).toEqual(
        expect.objectContaining({
          ...createParams,
          _id: generateObjectId(id),
          memberId: generateObjectId(memberId),
          status: TodoStatus.ended,
          end: expect.any(Date),
          createdBy: generateObjectId(memberId),
          updatedBy: generateObjectId(userId),
          createdAt: expect.any(Date),
          updatedAt: expect.any(Date),
        }),
      );

      expect(endedTodo).toEqual(
        expect.objectContaining({
          ...updateParamsWithNoId,
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore
          _id: endedTodo._id,
          memberId: generateObjectId(memberId),
          cronExpressions: expect.arrayContaining([...updateParams.cronExpressions]),
          status: TodoStatus.active,
          createdBy: generateObjectId(memberId),
          updatedBy: generateObjectId(userId),
          createdAt: expect.any(Date),
          updatedAt: expect.any(Date),
        }),
      );
    });

    it('should throw an error if todo does not exists', async () => {
      const params: EndAndCreateTodoParams = generateEndAndCreateTodoParams({
        id: generateId(),
        memberId: generateId(),
        updatedBy: generateId(),
      });

      await expect(service.endAndCreateTodo(params)).rejects.toThrow(
        Errors.get(ErrorType.todoNotFound),
      );
    });
  });

  describe('deleteTodo', () => {
    it('should delete Todo', async () => {
      const memberId = generateId();
      const userId = generateId();

      const createParams: CreateTodoParams = generateCreateTodoParams({
        memberId,
        createdBy: memberId,
        updatedBy: memberId,
      });

      const { id } = await service.createTodo(createParams);

      const deleteParams: DeleteTodoParams = generateDeleteTodoParams({
        id,
        memberId: memberId,
        deletedBy: userId,
      });

      const result = await service.deleteTodo(deleteParams);
      expect(result).toBeTruthy();

      const deletedTodo = await todoModel.findById(id).lean();
      expect(deletedTodo).toEqual(
        expect.objectContaining({
          ...createParams,
          _id: generateObjectId(id),
          memberId: generateObjectId(memberId),
          status: TodoStatus.deleted,
          createdBy: generateObjectId(memberId),
          updatedBy: generateObjectId(memberId),
          deletedBy: generateObjectId(userId),
          createdAt: expect.any(Date),
          updatedAt: expect.any(Date),
        }),
      );
    });

    it('should throw an error if todo does not exists', async () => {
      const params: DeleteTodoParams = generateDeleteTodoParams({
        id: generateId(),
        memberId: generateId(),
        deletedBy: generateId(),
      });

      await expect(service.deleteTodo(params)).rejects.toThrow(Errors.get(ErrorType.todoNotFound));
    });
  });
});
