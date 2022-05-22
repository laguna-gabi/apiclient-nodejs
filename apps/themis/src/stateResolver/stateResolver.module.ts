import { Module } from '@nestjs/common';
import { StateResolverService } from './stateResolver.service';
import { CommonModule } from '../common';

@Module({
  imports: [CommonModule],
  providers: [StateResolverService],
  exports: [StateResolverService],
})
export class StateResolverModule {}
