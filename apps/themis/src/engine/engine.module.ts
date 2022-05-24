import { Module } from '@nestjs/common';
import { RulesModule } from '../rules';
import { EngineService } from './engine.service';
import { FetcherModule } from '../fetcher';
import { StateResolverModule } from '../stateResolver';

@Module({
  imports: [RulesModule, FetcherModule, StateResolverModule],
  providers: [EngineService],
  exports: [EngineService],
})
export class EngineModule {}
