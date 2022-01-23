import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { cloneDeep } from 'lodash';
import { Model, Types } from 'mongoose';
import {
  CreateTodoDoneParams,
  CreateTodoParams,
  DeleteTodoParams,
  EndAndCreateTodoParams,
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

    const endedTodo = await this.todoModel.findOneAndUpdate(
      { _id: new Types.ObjectId(id), memberId: new Types.ObjectId(memberId) },
      {
        $set: {
          end: new Date(),
          status: TodoStatus.ended,
          updatedBy: new Types.ObjectId(updatedBy),
        },
      },
    );

    if (!endedTodo) {
      throw new Error(Errors.get(ErrorType.todoNotFound));
    }

    const createdTodo = await this.todoModel.create({
      ...params,
      memberId: new Types.ObjectId(memberId),
      createdBy: new Types.ObjectId(endedTodo.createdBy),
      updatedBy: new Types.ObjectId(updatedBy),
    });

    return createdTodo;
  }

  async deleteTodo(deleteTodoParams: DeleteTodoParams): Promise<boolean> {
    const { memberId, id, deletedBy } = deleteTodoParams;

    const result = await this.todoModel.findOneAndUpdate(
      { _id: new Types.ObjectId(id), memberId: new Types.ObjectId(memberId) },
      {
        $set: {
          status: TodoStatus.deleted,
          deletedBy: new Types.ObjectId(deletedBy),
        },
      },
    );

    if (!result) {
      throw new Error(Errors.get(ErrorType.todoNotFound));
    }

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

  async getTodoDones(memberId: string): Promise<TodoDone[]> {
    return this.todoDoneModel.find({ memberId: new Types.ObjectId(memberId) });
  }
}
