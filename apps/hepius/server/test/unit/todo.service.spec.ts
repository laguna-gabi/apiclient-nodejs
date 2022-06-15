import { User } from '@argus/hepiusClient';
import { generateId, generateObjectId, mockLogger, mockProcessWarnings } from '@argus/pandora';
import { Test, TestingModule } from '@nestjs/testing';
import { add } from 'date-fns';
import { cloneDeep } from 'lodash';
import { Model, Types, model } from 'mongoose';
import {
  checkDelete,
  dbConnect,
  dbDisconnect,
  defaultModules,
  generateCreateActionTodoParams,
  generateCreateMemberParams,
  generateCreateTodoDoneParams,
  generateCreateTodoParams,
  generateCreateUserParams,
  generateGetTodoDonesParams,
  generateOrgParams,
  generateUpdateTodoParams,
  loadSessionClient,
  mockGenerateTodo,
} from '..';
import {
  AlertType,
  ErrorType,
  Errors,
  LoggerService,
  defaultTimestampsDbValues,
} from '../../src/common';
import { JourneyService } from '../../src/journey';
import { MemberModule, MemberService } from '../../src/member';
import { Org, OrgDocument, OrgDto, OrgModule } from '../../src/org';
import { NotificationService } from '../../src/services';
import {
  CreateActionTodoParams,
  CreateTodoDoneParams,
  CreateTodoParams,
  Todo,
  TodoDocument,
  TodoDone,
  TodoDoneDocument,
  TodoDoneDto,
  TodoDto,
  TodoLabel,
  TodoModule,
  TodoService,
  TodoStatus,
  UpdateTodoParams,
} from '../../src/todo';
import { UserDocument, UserDto } from '../../src/user';

describe('TodoService', () => {
  let module: TestingModule;
  let service: TodoService;
  let memberService: MemberService;
  let journeyService: JourneyService;
  let todoModel: Model<TodoDocument & defaultTimestampsDbValues>;
  let todoDoneModel: Model<TodoDoneDocument>;
  let modelUser: Model<UserDocument>;
  let modelOrg: Model<OrgDocument>;

  beforeAll(async () => {
    mockProcessWarnings(); // to hide pino prettyPrint warning
    module = await Test.createTestingModule({
      imports: defaultModules().concat(TodoModule, MemberModule, OrgModule),
    }).compile();

    service = module.get<TodoService>(TodoService);
    memberService = module.get<MemberService>(MemberService);
    journeyService = module.get<JourneyService>(JourneyService);
    mockLogger(module.get<LoggerService>(LoggerService));

    todoModel = model<TodoDocument & defaultTimestampsDbValues>(Todo.name, TodoDto);
    todoDoneModel = model<TodoDoneDocument>(TodoDone.name, TodoDoneDto);
    modelUser = model<UserDocument>(User.name, UserDto);
    modelOrg = model<OrgDocument>(Org.name, OrgDto);

    await dbConnect();
  });

  afterAll(async () => {
    await module.close();
    await dbDisconnect();
  });

  describe('createTodo', () => {
    it('should create todo', async () => {
      const memberId = generateId();
      const journeyId = generateId();

      loadSessionClient(memberId);

      const params: CreateTodoParams = generateCreateTodoParams({
        memberId,
        journeyId,
      });

      const todo = await service.createTodo(params);
      expect(todo).not.toBeUndefined();

      const createdTodo = await todoModel.findById(todo.id).lean();
      expect(createdTodo).toEqual(
        expect.objectContaining({
          ...params,
          _id: generateObjectId(todo.id),
          memberId: generateObjectId(memberId),
          journeyId: generateObjectId(journeyId),
          status: TodoStatus.active,
          createdBy: generateObjectId(memberId),
          updatedBy: generateObjectId(memberId),
          updatedAt: expect.any(Date),
          deleted: false,
        }),
      );
    });
  });

  describe('createActionTodo', () => {
    it('should create action todo', async () => {
      const memberId = generateId();
      const journeyId = generateId();

      loadSessionClient(memberId);

      const params: CreateActionTodoParams = generateCreateActionTodoParams({
        memberId,
        journeyId,
      });

      const todo = await service.createActionTodo(params);
      expect(todo).not.toBeUndefined();

      const createdTodo = await todoModel.findById(todo.id).lean();
      expect(createdTodo).toEqual(
        expect.objectContaining({
          ...params,
          _id: generateObjectId(todo.id),
          memberId: generateObjectId(memberId),
          journeyId: generateObjectId(journeyId),
          status: TodoStatus.active,
          createdBy: generateObjectId(memberId),
          updatedBy: generateObjectId(memberId),
          updatedAt: expect.any(Date),
          deleted: false,
        }),
      );
    });
  });

  describe('getTodos', () => {
    it('should get todos', async () => {
      const memberId = generateId();
      const journeyId = generateId();
      const userId = generateId();

      const params1: CreateTodoParams = generateCreateTodoParams({
        memberId,
        journeyId,
      });

      const params2: CreateTodoParams = generateCreateTodoParams({
        memberId,
        journeyId,
      });

      loadSessionClient(memberId);
      const { id: id1 } = await service.createTodo(params1);

      loadSessionClient(userId);
      const { id: id2 } = await service.createTodo(params2);

      const createdTodos = await service.getTodos(memberId, journeyId);

      expect(createdTodos).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            _id: generateObjectId(id1),
            memberId: generateObjectId(memberId),
            journeyId: generateObjectId(journeyId),
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
            deleted: false,
          }),
          expect.objectContaining({
            _id: generateObjectId(id2),
            memberId: generateObjectId(memberId),
            journeyId: generateObjectId(journeyId),
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
            deleted: false,
          }),
        ]),
      );
    });

    it('should get empty array if member doesnt have todos', async () => {
      const createdTodos = await service.getTodos(generateId(), generateId());
      expect(createdTodos).toEqual([]);
    });
  });

  describe('getTodo', () => {
    it('should get todo', async () => {
      const memberId = generateId();
      const journeyId = generateId();

      const params: CreateTodoParams = generateCreateTodoParams({
        memberId,
        journeyId,
      });

      const { id } = await service.createTodo(params);

      const createdTodo = await todoModel.findById(id);
      const result = await service.getTodo(id, memberId, journeyId);

      expect(createdTodo).toEqual(
        expect.objectContaining({
          ...result,
          status: TodoStatus.active,
          createdAt: expect.any(Date),
          updatedAt: expect.any(Date),
        }),
      );
    });

    it('should throw an error if todo does not exists', async () => {
      await expect(service.getTodo(generateId(), generateId(), generateId())).rejects.toThrow(
        Errors.get(ErrorType.todoNotFound),
      );
    });
  });

  describe('updateTodo', () => {
    it('should update Todo', async () => {
      const memberId = generateId();
      const journeyId = generateId();
      const userId = generateId();

      const createParams: CreateTodoParams = generateCreateTodoParams({
        memberId,
        journeyId,
      });

      loadSessionClient(memberId);

      const { id } = await service.createTodo(createParams);

      const updateTodoParams: UpdateTodoParams = generateUpdateTodoParams({
        id,
        memberId,
        journeyId,
      });
      const updateTodoParamsWithNoId = cloneDeep(updateTodoParams);
      delete updateTodoParamsWithNoId.id;

      loadSessionClient(userId);

      const createdTodo = await service.updateTodo(updateTodoParams);
      const updatedTodo = await todoModel.findById(id).lean();
      delete createParams.end;

      expect(updatedTodo).toEqual(
        expect.objectContaining({
          ...createParams,
          _id: generateObjectId(id),
          memberId: generateObjectId(memberId),
          journeyId: generateObjectId(journeyId),
          status: TodoStatus.updated,
          createdBy: generateObjectId(memberId),
          updatedBy: generateObjectId(userId),
          createdAt: expect.any(Date),
          updatedAt: expect.any(Date),
          deleted: false,
        }),
      );

      expect(createdTodo).toEqual(
        expect.objectContaining({
          ...updateTodoParamsWithNoId,
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore
          _id: createdTodo._id,
          cronExpressions: expect.arrayContaining([...updateTodoParams.cronExpressions]),
          memberId: generateObjectId(memberId),
          journeyId: generateObjectId(journeyId),
          status: TodoStatus.active,
          createdBy: generateObjectId(memberId),
          updatedBy: generateObjectId(userId),
          relatedTo: generateObjectId(id),
          createdAt: expect.any(Date),
          updatedAt: expect.any(Date),
          deleted: false,
        }),
      );
    });

    it(
      'should create new todo with start like the ended todo ' +
        'and the updated todo to have end to be its start ' +
        'if start was not provided and there is no todoDone',
      async () => {
        const memberId = generateId();
        const journeyId = generateId();

        const createParams: CreateTodoParams = generateCreateTodoParams({
          memberId,
          journeyId,
        });

        const { id } = await service.createTodo(createParams);

        const updateTodoParams: UpdateTodoParams = generateUpdateTodoParams({
          id,
          memberId,
          journeyId,
        });
        delete updateTodoParams.start;

        const createdTodo = await service.updateTodo(updateTodoParams);
        expect(createdTodo.start).toEqual(createParams.start);
        const updatedTodo = await todoModel.findById(id);
        expect(updatedTodo.end).toEqual(createParams.start);
      },
    );

    it(
      'should create new todo with start like the latest todoDone ' +
        'and the updated todo to have the end like the start of the latest todoDone ' +
        'if start was not provided and there is todoDone',
      async () => {
        const memberId = generateId();
        const journeyId = generateId();

        const createParams: CreateTodoParams = generateCreateTodoParams({
          memberId,
          journeyId,
        });

        const { id } = await service.createTodo(createParams);

        const createTodoDoneParams: CreateTodoDoneParams = generateCreateTodoDoneParams({
          todoId: id,
          memberId,
          journeyId,
        });

        await service.createTodoDone(createTodoDoneParams);

        const updateTodoParams: UpdateTodoParams = generateUpdateTodoParams({
          id,
          memberId,
          journeyId,
        });
        delete updateTodoParams.start;

        const createdTodo = await service.updateTodo(updateTodoParams);
        expect(createdTodo.start).toEqual(createTodoDoneParams.done);
        const updatedTodo = await todoModel.findById(id);
        expect(updatedTodo.end).toEqual(createTodoDoneParams.done);
      },
    );

    it('should set status to ended if updating an unscheduled todo', async () => {
      const memberId = generateId();
      const journeyId = generateId();

      const createTodoParams: CreateTodoParams = generateCreateTodoParams({
        memberId,
        journeyId,
      });
      delete createTodoParams.cronExpressions;
      delete createTodoParams.start;
      delete createTodoParams.end;

      const { id } = await service.createTodo(createTodoParams);

      const updateTodoParams: UpdateTodoParams = generateUpdateTodoParams({
        id,
        memberId,
        journeyId,
      });
      delete updateTodoParams.start;

      await service.updateTodo(updateTodoParams);

      const updatedTodo = await todoModel.findById(id);
      expect(updatedTodo.status).toEqual(TodoStatus.ended);
    });

    it('should throw an error if todo does not exists', async () => {
      const params: UpdateTodoParams = generateUpdateTodoParams({
        id: generateId(),
        memberId: generateId(),
        journeyId: generateId(),
      });

      await expect(service.updateTodo(params)).rejects.toThrow(Errors.get(ErrorType.todoNotFound));
    });

    test.each([TodoStatus.ended, TodoStatus.updated])(
      'should throw an error if todo status=%p',
      async (status) => {
        const memberId = generateId();
        const journeyId = generateId();
        const params: CreateTodoParams = generateCreateTodoParams({
          memberId,
          journeyId,
        });

        const { id } = await service.createTodo(params);
        await todoModel.findOneAndUpdate({ _id: new Types.ObjectId(id) }, { $set: { status } });

        const updateTodoParams: UpdateTodoParams = generateUpdateTodoParams({
          id,
          memberId,
          journeyId,
        });

        await expect(service.updateTodo(updateTodoParams)).rejects.toThrow(
          Errors.get(ErrorType.todoEndOrUpdateEndedOrUpdatedTodo),
        );
      },
    );

    it('should throw an error if action todo', async () => {
      const memberId = generateId();
      const journeyId = generateId();
      const params: CreateActionTodoParams = generateCreateActionTodoParams({
        memberId,
        journeyId,
      });

      const { id } = await service.createActionTodo(params);

      const updateTodoParams: UpdateTodoParams = generateUpdateTodoParams({
        id,
        memberId,
        journeyId,
      });

      await expect(service.updateTodo(updateTodoParams)).rejects.toThrow(
        Errors.get(ErrorType.todoUpdateActionTodo),
      );
    });
  });

  describe('endTodo', () => {
    it('should end Todo', async () => {
      const memberId = generateId();
      const journeyId = generateId();
      const userId = generateId();

      loadSessionClient(memberId);

      const createParams: CreateTodoParams = generateCreateTodoParams({
        memberId,
        journeyId,
      });

      const { id } = await service.createTodo(createParams);

      loadSessionClient(userId);
      await service.endTodo(id, userId);

      const endedTodo = await todoModel.findById(id).lean();
      expect(endedTodo).toEqual(
        expect.objectContaining({
          ...createParams,
          _id: generateObjectId(id),
          memberId: generateObjectId(memberId),
          journeyId: generateObjectId(journeyId),
          status: TodoStatus.ended,
          createdBy: generateObjectId(memberId),
          updatedBy: generateObjectId(userId),
          createdAt: expect.any(Date),
          updatedAt: expect.any(Date),
          deleted: false,
        }),
      );
    });

    it('should throw an error if todo does not exists', async () => {
      await expect(service.endTodo(generateId(), generateId())).rejects.toThrow(
        Errors.get(ErrorType.todoNotFound),
      );
    });

    test.each([TodoStatus.ended, TodoStatus.updated])(
      'should throw an error if todo status=%p',
      async (status) => {
        const memberId = generateId();
        const journeyId = generateId();

        const params: CreateTodoParams = generateCreateTodoParams({
          memberId,
          journeyId,
        });

        const { id } = await service.createTodo(params);
        await todoModel.findOneAndUpdate({ _id: new Types.ObjectId(id) }, { $set: { status } });

        await expect(service.endTodo(id, memberId)).rejects.toThrow(
          Errors.get(ErrorType.todoEndOrUpdateEndedOrUpdatedTodo),
        );
      },
    );
  });

  describe('approveTodo', () => {
    it('should approve todo', async () => {
      const memberId = generateId();
      const journeyId = generateId();

      loadSessionClient(memberId);

      const createTodoParams: CreateTodoParams = generateCreateTodoParams({
        memberId,
        journeyId,
        label: TodoLabel.Meds,
      });
      createTodoParams.status = TodoStatus.requested;

      const { id: todoId } = await service.createTodo(createTodoParams);

      let createdTodo = await todoModel.findById(todoId).lean();
      expect(createdTodo).toEqual(
        expect.objectContaining({
          ...createTodoParams,
          _id: generateObjectId(todoId),
          memberId: generateObjectId(memberId),
          journeyId: generateObjectId(journeyId),
          status: TodoStatus.requested,
          createdBy: generateObjectId(memberId),
          updatedBy: generateObjectId(memberId),
          createdAt: expect.any(Date),
          updatedAt: expect.any(Date),
          deleted: false,
        }),
      );

      const result = await service.approveTodo(todoId, memberId, journeyId);
      expect(result).toBeTruthy();

      createdTodo = await todoModel.findById(todoId).lean();
      expect(createdTodo).toEqual(
        expect.objectContaining({
          ...createTodoParams,
          _id: generateObjectId(todoId),
          memberId: generateObjectId(memberId),
          journeyId: generateObjectId(journeyId),
          status: TodoStatus.active,
          createdBy: generateObjectId(memberId),
          updatedBy: generateObjectId(memberId),
          createdAt: expect.any(Date),
          updatedAt: expect.any(Date),
          deleted: false,
        }),
      );
    });

    it('should fail if todo does not exists', async () => {
      await expect(service.approveTodo(generateId(), generateId(), generateId())).rejects.toThrow(
        Errors.get(ErrorType.todoNotFoundOrApproveNotRequested),
      );
    });

    it('should fail if status is not requested', async () => {
      const memberId = generateId();
      const journeyId = generateId();
      const createTodoParams: CreateTodoParams = generateCreateTodoParams({
        memberId,
        journeyId,
      });

      const { id: todoId } = await service.createTodo(createTodoParams);

      await expect(service.approveTodo(todoId, memberId, journeyId)).rejects.toThrow(
        Errors.get(ErrorType.todoNotFoundOrApproveNotRequested),
      );
    });
  });

  describe('createTodoDone', () => {
    it('should create TodoDone', async () => {
      const memberId = generateId();
      const journeyId = generateId();
      const createTodoParams: CreateTodoParams = generateCreateTodoParams({
        memberId,
        journeyId,
      });

      const { id: todoId } = await service.createTodo(createTodoParams);

      const createTodoDoneParams: CreateTodoDoneParams = generateCreateTodoDoneParams({
        todoId,
        memberId,
        journeyId,
      });

      const { id: todoDoneId } = await service.createTodoDone(createTodoDoneParams);
      expect(todoDoneId).not.toBeUndefined();

      const createdTodoDone = await todoDoneModel.findById(todoDoneId);
      expect(createdTodoDone).toEqual(
        expect.objectContaining({
          ...createTodoDoneParams,
          todoId: generateObjectId(todoId),
          _id: generateObjectId(todoDoneId),
          id: todoDoneId,
          memberId: generateObjectId(memberId),
          journeyId: generateObjectId(journeyId),
          createdAt: expect.any(Date),
          updatedAt: expect.any(Date),
          deleted: false,
        }),
      );
    });

    it('should throw an error if todo does not exists', async () => {
      await expect(service.createTodoDone(generateCreateTodoDoneParams())).rejects.toThrow(
        Errors.get(ErrorType.todoNotFound),
      );
    });

    test.each([TodoStatus.ended, TodoStatus.requested])(
      `should throw an error if status=%p`,
      async (status) => {
        const memberId = generateId();
        const journeyId = generateId();
        const createTodoParams: CreateTodoParams = generateCreateTodoParams({
          memberId,
          journeyId,
        });

        const { id: todoId } = await service.createTodo(createTodoParams);
        await todoModel.findOneAndUpdate({ _id: generateObjectId(todoId) }, { $set: { status } });

        const createTodoDoneParams: CreateTodoDoneParams = generateCreateTodoDoneParams({
          todoId,
          memberId,
          journeyId,
        });

        await expect(service.createTodoDone(createTodoDoneParams)).rejects.toThrow(
          Errors.get(ErrorType.todoCreateDoneStatus),
        );
      },
    );

    it(`if unscheduled todo should change status to ${TodoStatus.ended}`, async () => {
      const memberId = generateId();
      const journeyId = generateId();

      loadSessionClient(memberId);

      const createTodoParams: CreateTodoParams = generateCreateTodoParams({
        memberId,
        journeyId,
      });
      delete createTodoParams.cronExpressions;
      delete createTodoParams.start;
      delete createTodoParams.end;

      const { id: todoId } = await service.createTodo(createTodoParams);

      const createTodoDoneParams: CreateTodoDoneParams = generateCreateTodoDoneParams({
        todoId,
        memberId,
        journeyId,
      });

      const { id: todoDoneId } = await service.createTodoDone(createTodoDoneParams);
      expect(todoDoneId).not.toBeUndefined();

      const createdTodo = await todoModel.findById(todoId).lean();
      expect(createdTodo).toEqual(
        expect.objectContaining({
          ...CreateTodoParams,
          _id: generateObjectId(todoId),
          memberId: generateObjectId(memberId),
          journeyId: generateObjectId(journeyId),
          status: TodoStatus.ended,
          createdBy: generateObjectId(memberId),
          updatedBy: generateObjectId(memberId),
          createdAt: expect.any(Date),
          updatedAt: expect.any(Date),
          deleted: false,
        }),
      );
    });
  });

  describe('getTodoDones', () => {
    it('should get todoDones', async () => {
      const memberId = generateId();
      const journeyId = generateId();
      const createTodoParams: CreateTodoParams = generateCreateTodoParams({
        memberId,
        journeyId,
      });

      const { id: todoId } = await service.createTodo(createTodoParams);

      const createTodoDoneParams1: CreateTodoDoneParams = generateCreateTodoDoneParams({
        todoId,
        memberId,
        journeyId,
        done: add(new Date(), { days: 1 }),
      });
      const createTodoDoneParams2: CreateTodoDoneParams = generateCreateTodoDoneParams({
        todoId,
        memberId,
        journeyId,
        done: add(new Date(), { days: 2 }),
      });

      const { id: todoDoneId1 } = await service.createTodoDone(createTodoDoneParams1);
      const { id: todoDoneId2 } = await service.createTodoDone(createTodoDoneParams2);

      let getTodoDonesParams = generateGetTodoDonesParams({ memberId, journeyId });

      let createdTodoDones = await service.getTodoDones(getTodoDonesParams);
      expect(createdTodoDones.length).toEqual(2);
      expect(createdTodoDones).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            _id: generateObjectId(todoDoneId1),
            id: todoDoneId1,
            memberId: generateObjectId(memberId),
            journeyId: generateObjectId(journeyId),
            done: createTodoDoneParams1.done,
            createdAt: expect.any(Date),
            updatedAt: expect.any(Date),
            deleted: false,
          }),
          expect.objectContaining({
            _id: generateObjectId(todoDoneId2),
            id: todoDoneId2,
            memberId: generateObjectId(memberId),
            journeyId: generateObjectId(journeyId),
            done: createTodoDoneParams2.done,
            createdAt: expect.any(Date),
            updatedAt: expect.any(Date),
            deleted: false,
          }),
        ]),
      );

      getTodoDonesParams = generateGetTodoDonesParams({
        memberId,
        journeyId,
        end: add(new Date(), { days: 1, hours: 1 }),
      });

      createdTodoDones = await service.getTodoDones(getTodoDonesParams);
      expect(createdTodoDones.length).toEqual(1);
      expect(createdTodoDones).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            _id: generateObjectId(todoDoneId1),
            id: todoDoneId1,
            memberId: generateObjectId(memberId),
            journeyId: generateObjectId(journeyId),
            done: createTodoDoneParams1.done,
            createdAt: expect.any(Date),
            updatedAt: expect.any(Date),
            deleted: false,
          }),
        ]),
      );
    });

    it('should get empty array if member doesnt have todoDones', async () => {
      const getTodoDonesParams = generateGetTodoDonesParams({
        memberId: generateId(),
        journeyId: generateId(),
      });
      const createdTodoDones = await service.getTodoDones(getTodoDonesParams);
      expect(createdTodoDones).toEqual([]);
    });
  });

  describe('deleteTodoDone', () => {
    it('should delete TodoDone', async () => {
      const memberId = generateId();
      const journeyId = generateId();
      const createTodoParams: CreateTodoParams = generateCreateTodoParams({
        memberId,
        journeyId,
      });

      const { id: todoId } = await service.createTodo(createTodoParams);

      const createTodoDoneParams: CreateTodoDoneParams = generateCreateTodoDoneParams({
        todoId,
        memberId,
        journeyId,
      });

      const { id: todoDoneId } = await service.createTodoDone(createTodoDoneParams);

      const createdTodoDone = await todoDoneModel.findById(todoDoneId).lean();
      expect(createdTodoDone).not.toBeUndefined();

      const result = await service.deleteTodoDone(todoDoneId, memberId, journeyId);
      expect(result).toBeTruthy();
      const deletedTodoDone = await todoDoneModel.findById(todoDoneId).lean();
      expect(deletedTodoDone).toBeNull();
    });

    it('should throw an error if todoDone does not exists', async () => {
      await expect(
        service.deleteTodoDone(generateId(), generateId(), generateId()),
      ).rejects.toThrow(Errors.get(ErrorType.todoDoneNotFound));
    });

    it(`should throw an error if todo status is ${TodoStatus.ended}`, async () => {
      const memberId = generateId();
      const journeyId = generateId();
      const createTodoParams: CreateTodoParams = generateCreateTodoParams({
        memberId,
        journeyId,
      });

      const { id: todoId } = await service.createTodo(createTodoParams);

      const createTodoDoneParams: CreateTodoDoneParams = generateCreateTodoDoneParams({
        todoId,
        memberId,
        journeyId,
      });

      const { id: todoDoneId } = await service.createTodoDone(createTodoDoneParams);

      await service.endTodo(todoId, memberId);

      await expect(service.deleteTodoDone(todoDoneId, memberId, journeyId)).rejects.toThrow(
        Errors.get(ErrorType.todoDeleteDoneStatus),
      );
    });

    it(`if todo unscheduled should update status to ${TodoStatus.active}`, async () => {
      const memberId = generateId();
      const journeyId = generateId();

      loadSessionClient(memberId);
      const createTodoParams: CreateTodoParams = generateCreateTodoParams({
        memberId,
        journeyId,
      });
      delete createTodoParams.cronExpressions;
      delete createTodoParams.start;
      delete createTodoParams.end;

      const { id: todoId } = await service.createTodo(createTodoParams);

      const createTodoDoneParams: CreateTodoDoneParams = generateCreateTodoDoneParams({
        todoId,
        memberId,
        journeyId,
      });

      const { id: todoDoneId } = await service.createTodoDone(createTodoDoneParams);
      let createdTodo = await todoModel.findById(todoId).lean();
      expect(createdTodo).toEqual(
        expect.objectContaining({
          ...CreateTodoParams,
          _id: generateObjectId(todoId),
          memberId: generateObjectId(memberId),
          journeyId: generateObjectId(journeyId),
          status: TodoStatus.ended,
          createdBy: generateObjectId(memberId),
          updatedBy: generateObjectId(memberId),
          createdAt: expect.any(Date),
          updatedAt: expect.any(Date),
          deleted: false,
        }),
      );

      const createdTodoDone = await todoDoneModel.findById(todoDoneId).lean();
      expect(createdTodoDone).not.toBeUndefined();

      await service.deleteTodoDone(todoDoneId, memberId, journeyId);

      createdTodo = await todoModel.findById(todoId).lean();
      expect(createdTodo).toEqual(
        expect.objectContaining({
          ...CreateTodoParams,
          _id: generateObjectId(todoId),
          memberId: generateObjectId(memberId),
          journeyId: generateObjectId(journeyId),
          status: TodoStatus.active,
          createdBy: generateObjectId(memberId),
          updatedBy: generateObjectId(memberId),
          createdAt: expect.any(Date),
          updatedAt: expect.any(Date),
          deleted: false,
        }),
      );
    });
  });

  describe('deleteTodos', () => {
    test.each([true, false])('should soft delete member Todos and TodoDones', async (hard) => {
      const memberId = generateId();
      const journeyId = generateId();
      const createTodoParams: CreateTodoParams = generateCreateTodoParams({
        memberId,
        journeyId,
      });

      const { id: todoId } = await service.createTodo(createTodoParams);

      const createTodoDoneParams: CreateTodoDoneParams = generateCreateTodoDoneParams({
        todoId,
        memberId,
        journeyId,
      });

      await service.createTodoDone(createTodoDoneParams);

      const getResults = async () => {
        const resTodo = await service.getTodos(memberId, journeyId);
        const resTodoDone = await service.getTodoDones({
          start: createTodoParams.start,
          end: createTodoParams.end,
          memberId,
          journeyId,
        });

        return { resTodo, resTodoDone };
      };

      const { resTodo, resTodoDone } = await getResults();
      expect(resTodo).toHaveLength(1);
      expect(resTodoDone).toHaveLength(1);
      await service.deleteMemberTodos({ memberId, deletedBy: memberId, hard });
      const { resTodo: resTodoDeleted, resTodoDone: resTodoDoneDeleted } = await getResults();
      expect(resTodoDeleted).toHaveLength(0);
      expect(resTodoDoneDeleted).toHaveLength(0);

      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      const deletedTodo = await todoModel.findWithDeleted({
        memberId: new Types.ObjectId(memberId),
        journeyId: new Types.ObjectId(journeyId),
      });

      if (hard) {
        expect(deletedTodo).toEqual([]);
      } else {
        await checkDelete(deletedTodo, { memberId: new Types.ObjectId(memberId) }, memberId);
      }
    });
  });

  describe('todos alerts', () => {
    let mockNotificationGetDispatchesByClientSenderId: jest.SpyInstance;

    beforeAll(() => {
      mockNotificationGetDispatchesByClientSenderId = jest.spyOn(
        module.get<NotificationService>(NotificationService),
        `getDispatchesByClientSenderId`,
      );
    });

    afterEach(() => {
      mockNotificationGetDispatchesByClientSenderId.mockReset();
    });

    it('should return todos created by member alerts', async () => {
      mockNotificationGetDispatchesByClientSenderId.mockResolvedValue(undefined);
      // create a new member
      const { memberId, journeyId } = await generateMember();

      const member = await memberService.get(memberId);

      const mockTodo = mockGenerateTodo({
        memberId: generateObjectId(memberId),
        journeyId: generateObjectId(journeyId),
        createdBy: generateObjectId(memberId),
        updatedBy: generateObjectId(memberId),
      });
      delete mockTodo.id;

      const todo = await todoModel.create(mockTodo);

      const alerts = await service.getAlerts(member.primaryUserId.toString(), [member]);

      expect(alerts).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: `${todo.id}_${AlertType.memberCreateTodo}`,
            type: AlertType.memberCreateTodo,
            date: todo.createdAt,
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore
            text: service.internationalization.getAlerts(AlertType.memberCreateTodo, {
              member,
              todoText: todo.text,
            }),
            memberId: member.id,
            dismissed: false,
            isNew: true,
          }),
        ]),
      );
    });

    it('should not return todos created by member if they are related alerts', async () => {
      mockNotificationGetDispatchesByClientSenderId.mockResolvedValue(undefined);
      // create a new member
      const { memberId, journeyId } = await generateMember();

      const member = await memberService.get(memberId);

      const mockTodo = mockGenerateTodo({
        memberId: generateObjectId(memberId),
        journeyId: generateObjectId(journeyId),
        createdBy: generateObjectId(memberId),
        updatedBy: generateObjectId(memberId),
      });
      mockTodo.relatedTo = generateObjectId();
      delete mockTodo.id;

      const todo = await todoModel.create(mockTodo);

      const alerts = await service.getAlerts(member.primaryUserId.toString(), [member]);

      expect(alerts).toEqual(
        expect.not.arrayContaining([
          expect.objectContaining({
            id: `${todo.id}_${AlertType.memberCreateTodo}`,
            type: AlertType.memberCreateTodo,
            date: todo.createdAt,
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore
            text: service.internationalization.getAlerts(AlertType.memberCreateTodo, {
              member,
              todoText: todo.text,
            }),
            memberId: member.id,
            dismissed: false,
            isNew: true,
          }),
        ]),
      );
    });
  });

  const generateMember = async (orgId?: string, userId?: string) => {
    orgId = orgId ? orgId : await generateOrg();
    userId = userId ? userId : await generateUser();
    const createMemberParams = generateCreateMemberParams({ orgId });
    delete createMemberParams.orgId;
    const { id: memberId } = await memberService.insert(
      { ...createMemberParams, phoneType: 'mobile' },
      new Types.ObjectId(userId),
    );
    const { id: journeyId } = await journeyService.create({ memberId, orgId });

    return { memberId, journeyId, userId };
  };

  const generateOrg = async (): Promise<string> => {
    const { _id: ordId } = await modelOrg.create(generateOrgParams());
    return ordId.toString();
  };

  const generateUser = async (): Promise<string> => {
    const { _id: userId } = await modelUser.create(generateCreateUserParams());
    return userId.toString();
  };
});
