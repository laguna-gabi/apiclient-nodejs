import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { CommonModule } from './common';

@Module({
  imports: [EventEmitterModule.forRoot(), CommonModule],
  controllers: [],
})
export class AppModule {}
