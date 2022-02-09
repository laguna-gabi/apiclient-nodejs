import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CommonModule } from '../common';
import { Todo, TodoDone, TodoDoneDto, TodoDto, TodoResolver, TodoService } from '.';
import { useFactoryOptions } from '../db';
import * as mongooseDelete from 'mongoose-delete';

@Module({
  imports: [
    CommonModule,
    MongooseModule.forFeatureAsync([
      {
        name: Todo.name,
        useFactory: () => {
          return TodoDto.plugin(mongooseDelete, useFactoryOptions);
        },
      },
      {
        name: TodoDone.name,
        useFactory: () => {
          return TodoDoneDto.plugin(mongooseDelete, useFactoryOptions);
        },
      },
    ]),
  ],
  providers: [TodoResolver, TodoService],
})
export class TodoModule {}
