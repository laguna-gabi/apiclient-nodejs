import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CommonModule } from '../common';
import { Todo, TodoDone, TodoDoneDto, TodoDto, TodoResolver, TodoService } from '.';
import { JourneyModule } from '../journey';
import { ProvidersModule } from '../providers';

@Module({
  imports: [
    CommonModule,
    ProvidersModule,
    JourneyModule,
    MongooseModule.forFeature([
      { name: Todo.name, schema: TodoDto },
      { name: TodoDone.name, schema: TodoDoneDto },
    ]),
  ],
  providers: [TodoResolver, TodoService],
  exports: [TodoService],
})
export class TodoModule {}
