import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CommonModule } from '../common';
import { Todo, TodoDto, TodoResolver, TodoService } from '.';

@Module({
  imports: [CommonModule, MongooseModule.forFeature([{ name: Todo.name, schema: TodoDto }])],
  providers: [TodoResolver, TodoService],
})
export class TodoModule {}
