import { Query, Resolver } from '@nestjs/graphql';
import { RuleEngineService } from './engine.service';

@Resolver()
export class EngineResolver {
  constructor(private readonly ruleEngineService: RuleEngineService) {}

  @Query()
  async runEngine(facts) {
    return this.ruleEngineService.start(facts);
  }
}
