import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CommonModule } from '../common';
import { Todo, TodoDone, TodoDoneDto, TodoDto, TodoResolver, TodoService } from '.';

@Module({
  imports: [
    CommonModule,
    MongooseModule.forFeature([
      { name: Todo.name, schema: TodoDto },
      { name: TodoDone.name, schema: TodoDoneDto },
    ]),
  ],
  providers: [TodoResolver, TodoService],
})
export class TodoModule {}
