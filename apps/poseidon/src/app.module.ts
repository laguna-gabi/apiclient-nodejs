import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { DbModule } from './db';
import { ProvidersModule } from './providers';

@Module({
  imports: [ProvidersModule, DbModule, EventEmitterModule.forRoot()],
  controllers: [],
})
export class AppModule {}
