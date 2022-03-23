import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  ActionTodoLabel,
  CreateActionTodoParams,
  CreateTodoDoneParams,
  CreateTodoParams,
  EndAndCreateTodoParams,
  GetTodoDonesParams,
  NotNullableTodoKeys,
  Todo,
  TodoDocument,
  TodoDone,
  TodoDoneDocument,
  TodoStatus,
} from '.';
import {
  BaseService,
  ErrorType,
  Errors,
  EventType,
  IEventDeleteMember,
  Identifier,
  LoggerService,
  deleteMemberObjects,
} from '../common';
import { ISoftDelete } from '../db';

@Injectable()
export class TodoService extends BaseService {
  constructor(
    @InjectModel(Todo.name)
    private readonly todoModel: Model<TodoDocument> & ISoftDelete<TodoDocument>,
    @InjectModel(TodoDone.name)
    private readonly todoDoneModel: Model<TodoDoneDocument> & ISoftDelete<TodoDoneDocument>,
    readonly logger: LoggerService,
  ) {
    super();
  }

  async createTodo(createTodoParams: CreateTodoParams): Promise<Todo> {
    return this.todoModel.create({
      ...this.removeNotNullable(createTodoParams, NotNullableTodoKeys),
      memberId: new Types.ObjectId(createTodoParams.memberId),
    });
  }

  async createActionTodo(createActionTodoParams: CreateActionTodoParams): Promise<Todo> {
    return this.todoModel.create({
      ...createActionTodoParams,
      memberId: new Types.ObjectId(createActionTodoParams.memberId),
    });
  }

  async getTodos(memberId: string): Promise<Todo[]> {
    return this.todoModel.find({ memberId: new Types.ObjectId(memberId) });
  }

  async getTodo(id: string, memberId: string): Promise<Todo> {
    const result = await this.todoModel.findOne({
      _id: new Types.ObjectId(id),
      memberId: new Types.ObjectId(memberId),
    });

    if (!result) {
      throw new Error(Errors.get(ErrorType.todoNotFound));
    }

    return result;
  }

  async endAndCreateTodo(endAndCreateTodoParams: EndAndCreateTodoParams): Promise<Todo> {
    const { memberId, id, ...params } = this.removeNotNullable(
      endAndCreateTodoParams,
      NotNullableTodoKeys,
    );

    const endedTodo = await this.todoModel.findOne({
      _id: new Types.ObjectId(id),
      memberId: new Types.ObjectId(memberId),
    });

    if (!endedTodo) {
      throw new Error(Errors.get(ErrorType.todoNotFound));
    }

    if (endedTodo.status === TodoStatus.ended) {
      throw new Error(Errors.get(ErrorType.todoEndEndedTodo));
    }

    if (this.isActionTodo(endedTodo)) {
      throw new Error(Errors.get(ErrorType.todoEndAndCreateActionTodo));
    }

    await endedTodo.updateOne({
      $set: {
        status: TodoStatus.ended,
      },
    });

    if (params.cronExpressions && !params.start) {
      const [lastTodoDone] = await this.todoDoneModel
        .find({ todoId: new Types.ObjectId(id) })
        .sort({ done: -1 })
        .limit(1);
      if (lastTodoDone) {
        params.start = lastTodoDone.done;
      } else {
        params.start = endedTodo.start;
      }
    }

    return this.todoModel.create({
      ...params,
      memberId: new Types.ObjectId(memberId),
      relatedTo: new Types.ObjectId(id),
      createdBy: new Types.ObjectId(endedTodo.createdBy),
    });
  }

  async endTodo(id, updatedBy): Promise<Todo> {
    const endedTodo = await this.todoModel.findOne({ _id: new Types.ObjectId(id) });

    if (!endedTodo) {
      throw new Error(Errors.get(ErrorType.todoNotFound));
    }

    if (endedTodo.status === TodoStatus.ended) {
      throw new Error(Errors.get(ErrorType.todoEndEndedTodo));
    }

    await endedTodo.updateOne({
      $set: {
        status: TodoStatus.ended,
        updatedBy: new Types.ObjectId(updatedBy),
      },
    });

    return endedTodo;
  }

  async approveTodo(id: string, memberId: string): Promise<boolean> {
    const todo = await this.todoModel.findOneAndUpdate(
      {
        _id: new Types.ObjectId(id),
        memberId: new Types.ObjectId(memberId),
        status: TodoStatus.requested,
      },
      { $set: { status: TodoStatus.active } },
    );

    if (!todo) {
      throw new Error(Errors.get(ErrorType.todoNotFoundOrApproveNotRequested));
    }

    return true;
  }

  async createTodoDone(createTodoDoneParams: CreateTodoDoneParams): Promise<Identifier> {
    const { todoId, memberId } = createTodoDoneParams;
    const todo = await this.todoModel.findOne({
      _id: new Types.ObjectId(todoId),
      memberId: new Types.ObjectId(memberId),
    });

    if (!todo) {
      throw new Error(Errors.get(ErrorType.todoNotFound));
    }

    if (todo.status === TodoStatus.ended || todo.status === TodoStatus.requested) {
      throw new Error(Errors.get(ErrorType.todoCreateDoneStatus));
    }

    if (this.isUnscheduled(todo)) {
      await todo.updateOne({
        $set: {
          status: TodoStatus.ended,
        },
      });
    }

    const { _id } = await this.todoDoneModel.create({
      ...createTodoDoneParams,
      todoId: new Types.ObjectId(todoId),
      memberId: new Types.ObjectId(memberId),
    });

    return { id: _id };
  }

  async getTodoDones(getTodoDonesParams: GetTodoDonesParams): Promise<TodoDone[]> {
    const { memberId, start, end } = getTodoDonesParams;
    return this.todoDoneModel.find({
      memberId: new Types.ObjectId(memberId),
      done: { $gte: start, $lte: end },
    });
  }

  async deleteTodoDone(id: string, memberId: string): Promise<boolean> {
    const todoDone = await this.todoDoneModel.findOne({
      _id: new Types.ObjectId(id),
      memberId: new Types.ObjectId(memberId),
    });

    if (!todoDone) {
      throw new Error(Errors.get(ErrorType.todoDoneNotFound));
    }

    const todo = await this.todoModel.findById(todoDone.todoId);

    if (todo.status === TodoStatus.ended) {
      if (this.isUnscheduled(todo)) {
        await todo.updateOne({
          $set: {
            status: TodoStatus.active,
          },
        });
      } else {
        throw new Error(Errors.get(ErrorType.todoDeleteDoneStatus));
      }
    }

    await todoDone.deleteOne();

    return true;
  }

  @OnEvent(EventType.onDeletedMember, { async: true })
  async deleteMemberTodos(params: IEventDeleteMember) {
    await deleteMemberObjects<Model<TodoDocument> & ISoftDelete<TodoDocument>>(
      params,
      this.todoModel,
      this.logger,
      this.deleteMemberTodos.name,
      TodoService.name,
    );

    await deleteMemberObjects<Model<TodoDoneDocument> & ISoftDelete<TodoDoneDocument>>(
      params,
      this.todoDoneModel,
      this.logger,
      this.deleteMemberTodos.name,
      TodoService.name,
    );
  }

  /*************************************************************************************************
   ******************************************** Helpers ********************************************
   ************************************************************************************************/

  isActionTodo(todo: Todo): boolean {
    return Object.keys(ActionTodoLabel).includes(todo.label);
  }

  private isUnscheduled(todo: Todo): boolean {
    return !todo.cronExpressions && !todo.start && !todo.end;
  }
}
