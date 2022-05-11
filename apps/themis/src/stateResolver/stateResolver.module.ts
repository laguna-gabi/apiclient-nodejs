import { Module } from '@nestjs/common';
import { StateResolverService } from './stateResolver.service';

@Module({
  providers: [StateResolverService],
  exports: [StateResolverService],
})
export class StateResolverModule {}
