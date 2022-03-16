import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { ProvidersModule } from '../../src/providers';
import { NotificationService } from '.';
import { CommonModule } from '../common';

@Module({
  imports: [HttpModule, CommonModule, ProvidersModule],
  providers: [NotificationService],
  exports: [NotificationService],
})
export class ServiceModule {}
