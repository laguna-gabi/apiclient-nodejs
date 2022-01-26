import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { cloneDeep } from 'lodash';
import { Model, Types } from 'mongoose';
import {
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
import { BaseService, ErrorType, Errors, Identifier } from '../common';

@Injectable()
export class TodoService extends BaseService {
  constructor(
    @InjectModel(Todo.name) private readonly todoModel: Model<TodoDocument>,
    @InjectModel(TodoDone.name) private readonly todoDoneModel: Model<TodoDoneDocument>,
  ) {
    super();
  }

  async createTodo(createTodoParams: CreateTodoParams): Promise<Identifier> {
    this.removeNotNullable(createTodoParams, NotNullableTodoKeys);
    const { memberId, createdBy, updatedBy } = createTodoParams;

    const { _id } = await this.todoModel.create({
      ...createTodoParams,
      memberId: new Types.ObjectId(memberId),
      createdBy: new Types.ObjectId(createdBy),
      updatedBy: new Types.ObjectId(updatedBy),
    });

    return { id: _id };
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
    this.removeNotNullable(endAndCreateTodoParams, NotNullableTodoKeys);
    const { memberId, id, updatedBy } = endAndCreateTodoParams;
    const params = cloneDeep(endAndCreateTodoParams);
    delete params.id;

    const endedTodo = await this.todoModel.findOne({
      _id: new Types.ObjectId(id),
      memberId: new Types.ObjectId(memberId),
    });

    if (!endedTodo) {
      throw new Error(Errors.get(ErrorType.todoNotFound));
    }

    if (endedTodo.end?.getTime() < new Date().getTime() || endedTodo.status === TodoStatus.ended) {
      throw new Error(Errors.get(ErrorType.todoEndEndedTodo));
    }

    await endedTodo.updateOne({
      $set: {
        status: TodoStatus.ended,
        updatedBy: new Types.ObjectId(updatedBy),
      },
    });

    const createdTodo = await this.todoModel.create({
      ...params,
      memberId: new Types.ObjectId(memberId),
      createdBy: new Types.ObjectId(endedTodo.createdBy),
      updatedBy: new Types.ObjectId(updatedBy),
    });

    return createdTodo;
  }

  async endTodo(id, updatedBy): Promise<boolean> {
    const endedTodo = await this.todoModel.findOne({ _id: new Types.ObjectId(id) });

    if (!endedTodo) {
      throw new Error(Errors.get(ErrorType.todoNotFound));
    }

    if (endedTodo.end?.getTime() < new Date().getTime() || endedTodo.status === TodoStatus.ended) {
      throw new Error(Errors.get(ErrorType.todoEndEndedTodo));
    }

    await endedTodo.updateOne({
      $set: {
        status: TodoStatus.ended,
        updatedBy: new Types.ObjectId(updatedBy),
      },
    });

    return true;
  }

  async createTodoDone(createTodoDoneParams: CreateTodoDoneParams): Promise<Identifier> {
    const { todoId, memberId } = createTodoDoneParams;

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
    const result = await this.todoDoneModel.findOneAndDelete({
      _id: new Types.ObjectId(id),
      memberId: new Types.ObjectId(memberId),
    });

    if (!result) {
      throw new Error(Errors.get(ErrorType.todoDoneNotFound));
    }

    return true;
  }
}
