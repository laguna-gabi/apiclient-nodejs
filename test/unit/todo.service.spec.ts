import { mockLogger, mockProcessWarnings } from '@lagunahealth/pandora';
import { Test, TestingModule } from '@nestjs/testing';
import { add } from 'date-fns';
import * as faker from 'faker';
import { cloneDeep } from 'lodash';
import { Model, model } from 'mongoose';
import { ErrorType, Errors, LoggerService } from '../../src/common';
import {
  CreateTodoDoneParams,
  CreateTodoParams,
  EndAndCreateTodoParams,
  Todo,
  TodoDone,
  TodoDoneDto,
  TodoDto,
  TodoModule,
  TodoService,
} from '../../src/todo';
import {
  dbConnect,
  dbDisconnect,
  defaultModules,
  generateCreateTodoDoneParams,
  generateCreateTodoParams,
  generateEndAndCreateTodoParams,
  generateGetTodoDonesParams,
  generateId,
  generateObjectId,
} from '../index';

describe('TodoService', () => {
  let module: TestingModule;
  let service: TodoService;
  let todoModel: Model<typeof TodoDto>;
  let todoDoneModel: Model<typeof TodoDoneDto>;

  beforeAll(async () => {
    mockProcessWarnings(); // to hide pino prettyPrint warning
    module = await Test.createTestingModule({
      imports: defaultModules().concat(TodoModule),
    }).compile();

    service = module.get<TodoService>(TodoService);
    mockLogger(module.get<LoggerService>(LoggerService));

    todoModel = model(Todo.name, TodoDto);
    todoDoneModel = model(TodoDone.name, TodoDoneDto);

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

  describe('getTodo', () => {
    it('should get todo', async () => {
      const memberId = generateId();

      const params: CreateTodoParams = generateCreateTodoParams({
        memberId,
        createdBy: memberId,
        updatedBy: memberId,
      });

      const { id } = await service.createTodo(params);

      const createdTodo = await todoModel.findById(id);
      const result = await service.getTodo(id, memberId);

      expect(createdTodo).toEqual(
        expect.objectContaining({
          ...result,
          createdAt: expect.any(Date),
          updatedAt: expect.any(Date),
        }),
      );
    });

    it('should throw an error if todo does not exists', async () => {
      await expect(service.getTodo(generateId(), generateId())).rejects.toThrow(
        Errors.get(ErrorType.todoNotFound),
      );
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

      const endAndCreateTodoParams: EndAndCreateTodoParams = generateEndAndCreateTodoParams({
        id,
        memberId,
        updatedBy: userId,
      });
      const endAndCreateTodoParamsWithNoId = cloneDeep(endAndCreateTodoParams);
      delete endAndCreateTodoParamsWithNoId.id;

      const endedTodo = await service.endAndCreateTodo(endAndCreateTodoParams);
      const oldTodo = await todoModel.findById(id).lean();
      delete createParams.end;

      expect(oldTodo).toEqual(
        expect.objectContaining({
          ...createParams,
          _id: generateObjectId(id),
          memberId: generateObjectId(memberId),
          end: expect.any(Date),
          createdBy: generateObjectId(memberId),
          updatedBy: generateObjectId(userId),
          createdAt: expect.any(Date),
          updatedAt: expect.any(Date),
        }),
      );

      expect(endedTodo).toEqual(
        expect.objectContaining({
          ...endAndCreateTodoParamsWithNoId,
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore
          _id: endedTodo._id,
          memberId: generateObjectId(memberId),
          cronExpressions: expect.arrayContaining([...endAndCreateTodoParams.cronExpressions]),
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

    it('should throw an error if todo end is in the past', async () => {
      const memberId = generateId();

      const params: CreateTodoParams = generateCreateTodoParams({
        memberId,
        createdBy: memberId,
        updatedBy: memberId,
        end: faker.date.recent(2),
      });

      const { id } = await service.createTodo(params);

      const endAndCreateTodoParams: EndAndCreateTodoParams = generateEndAndCreateTodoParams({
        id,
        memberId,
        updatedBy: memberId,
      });

      await expect(service.endAndCreateTodo(endAndCreateTodoParams)).rejects.toThrow(
        Errors.get(ErrorType.todoEndEndedTodo),
      );
    });
  });

  describe('endTodo', () => {
    it('should end Todo', async () => {
      const memberId = generateId();
      const userId = generateId();

      const createParams: CreateTodoParams = generateCreateTodoParams({
        memberId,
        createdBy: memberId,
        updatedBy: memberId,
      });

      const { id } = await service.createTodo(createParams);

      const result = await service.endTodo(id, userId);
      expect(result).toBeTruthy();

      const endedTodo = await todoModel.findById(id).lean();
      expect(endedTodo).toEqual(
        expect.objectContaining({
          ...createParams,
          _id: generateObjectId(id),
          memberId: generateObjectId(memberId),
          createdBy: generateObjectId(memberId),
          updatedBy: generateObjectId(userId),
          end: expect.any(Date),
          createdAt: expect.any(Date),
          updatedAt: expect.any(Date),
        }),
      );
    });

    it('should throw an error if todo does not exists', async () => {
      await expect(service.endTodo(generateId(), generateId())).rejects.toThrow(
        Errors.get(ErrorType.todoNotFound),
      );
    });

    it('should throw an error if todo end is in the past', async () => {
      const memberId = generateId();

      const params: CreateTodoParams = generateCreateTodoParams({
        memberId,
        createdBy: memberId,
        updatedBy: memberId,
        end: faker.date.recent(2),
      });

      const { id } = await service.createTodo(params);

      await expect(service.endTodo(id, memberId)).rejects.toThrow(
        Errors.get(ErrorType.todoEndEndedTodo),
      );
    });
  });

  describe('createTodoDone', () => {
    it('should create TodoDone', async () => {
      const memberId = generateId();
      const createTodoParams: CreateTodoParams = generateCreateTodoParams({
        memberId,
        createdBy: memberId,
        updatedBy: memberId,
      });

      const { id: todoId } = await service.createTodo(createTodoParams);

      const createTodoDoneParams: CreateTodoDoneParams = generateCreateTodoDoneParams({
        todoId,
        memberId,
      });

      const { id: todoDoneId } = await service.createTodoDone(createTodoDoneParams);
      expect(todoDoneId).not.toBeUndefined();

      const createdTodoDone = await todoDoneModel.findById(todoDoneId).lean();
      expect(createdTodoDone).toEqual(
        expect.objectContaining({
          ...createTodoDoneParams,
          _id: todoDoneId,
          memberId: generateObjectId(memberId),
          createdAt: expect.any(Date),
          updatedAt: expect.any(Date),
        }),
      );
    });
  });

  describe('getTodoDones', () => {
    it('should get todoDones', async () => {
      const memberId = generateId();
      const createTodoParams: CreateTodoParams = generateCreateTodoParams({
        memberId,
        createdBy: memberId,
        updatedBy: memberId,
      });

      const { id: todoId } = await service.createTodo(createTodoParams);

      const createTodoDoneParams1: CreateTodoDoneParams = generateCreateTodoDoneParams({
        todoId,
        memberId,
        done: add(new Date(), { days: 1 }),
      });
      const createTodoDoneParams2: CreateTodoDoneParams = generateCreateTodoDoneParams({
        todoId,
        memberId,
        done: add(new Date(), { days: 2 }),
      });

      const { id: todoDoneId1 } = await service.createTodoDone(createTodoDoneParams1);
      const { id: todoDoneId2 } = await service.createTodoDone(createTodoDoneParams2);

      let getTodoDonesParams = generateGetTodoDonesParams({ memberId });

      let createdTodoDones = await service.getTodoDones(getTodoDonesParams);
      expect(createdTodoDones.length).toEqual(2);
      expect(createdTodoDones).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            _id: todoDoneId1,
            memberId: generateObjectId(memberId),
            done: createTodoDoneParams1.done,
            createdAt: expect.any(Date),
            updatedAt: expect.any(Date),
          }),
          expect.objectContaining({
            _id: todoDoneId2,
            memberId: generateObjectId(memberId),
            done: createTodoDoneParams2.done,
            createdAt: expect.any(Date),
            updatedAt: expect.any(Date),
          }),
        ]),
      );

      getTodoDonesParams = generateGetTodoDonesParams({
        memberId,
        end: add(new Date(), { days: 1, hours: 1 }),
      });

      createdTodoDones = await service.getTodoDones(getTodoDonesParams);
      expect(createdTodoDones.length).toEqual(1);
      expect(createdTodoDones).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            _id: todoDoneId1,
            memberId: generateObjectId(memberId),
            done: createTodoDoneParams1.done,
            createdAt: expect.any(Date),
            updatedAt: expect.any(Date),
          }),
        ]),
      );
    });

    it('should get empty array if member doesnt have todoDones', async () => {
      const getTodoDonesParams = generateGetTodoDonesParams({ memberId: generateId() });
      const createdTodoDones = await service.getTodoDones(getTodoDonesParams);
      expect(createdTodoDones).toEqual([]);
    });
  });

  describe('deleteTodoDone', () => {
    it('should delete TodoDone', async () => {
      const memberId = generateId();
      const createTodoParams: CreateTodoParams = generateCreateTodoParams({
        memberId,
        createdBy: memberId,
        updatedBy: memberId,
      });

      const { id: todoId } = await service.createTodo(createTodoParams);

      const createTodoDoneParams: CreateTodoDoneParams = generateCreateTodoDoneParams({
        todoId,
        memberId,
      });

      const { id: todoDoneId } = await service.createTodoDone(createTodoDoneParams);

      const createdTodoDone = await todoDoneModel.findById(todoDoneId).lean();
      expect(createdTodoDone).not.toBeUndefined();

      const result = await service.deleteTodoDone(todoDoneId, memberId);
      expect(result).toBeTruthy();
      const deletedTodoDone = await todoDoneModel.findById(todoDoneId).lean();
      expect(deletedTodoDone).toBeNull();
    });

    it('should throw an error if todoDone does not exists', async () => {
      await expect(service.deleteTodoDone(generateId(), generateId())).rejects.toThrow(
        Errors.get(ErrorType.todoDoneNotFound),
      );
    });
  });
});
