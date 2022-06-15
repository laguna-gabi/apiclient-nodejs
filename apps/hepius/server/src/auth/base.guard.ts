import { ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { GqlContextType, GqlExecutionContext } from '@nestjs/graphql';
import { Connection, Types } from 'mongoose';
import { Filter, Sort } from 'mongodb';

@Injectable()
export class BaseGuard {
  constructor(readonly reflector: Reflector) {}

  getRequest(context: ExecutionContext) {
    if (context.getType<GqlContextType>() === 'graphql') {
      const ctx = GqlExecutionContext.create(context);
      return ctx.getContext().req;
    } else {
      return context.switchToHttp().getRequest();
    }
  }
}

export class EntityResolver {
  constructor(private readonly connection: Connection) {}

  async getEntityById(entityName: string, id: string) {
    return this.connection.db
      .collection(this.getCollectionName(entityName))
      .findOne({ _id: new Types.ObjectId(id) });
  }

  async getEntities<T>(
    entityName: string,
    {
      filter,
      sort,
      limit,
    }: {
      filter: Filter<T>;
      sort?: Sort;
      limit?: number;
    },
  ) {
    const sortObject = sort ? { sort } : {};
    const limitObject = limit ? { limit } : {};
    const result = await this.connection.db
      .collection(this.getCollectionName(entityName))
      .find({ ...filter }, { ...sortObject, ...limitObject });

    return result.toArray();
  }

  private getCollectionName(name: string): string {
    return name.toLowerCase() + 's';
  }
}
