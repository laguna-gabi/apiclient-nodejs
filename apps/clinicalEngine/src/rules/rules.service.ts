import { Injectable, OnModuleInit } from '@nestjs/common';
import engineFactory, {
  Engine,
  EngineOptions,
  EngineResult,
  RuleProperties,
} from 'json-rules-engine';
import { DynamicFact, EngineRule, MemberFacts } from './types';
import { Callbacks, Priorities, engineRules } from './rules';
import { LoggerService } from '../common';
import { dynamicFacts } from './facts';
import Mutex = require('ts-mutex');

@Injectable()
export class RulesService implements OnModuleInit {
  static lock = new Mutex();
  constructor(private logger: LoggerService) {}

  private engine: Engine;

  async onModuleInit() {
    // for now - loading rules only once
    // we might want to move it the 'run' method so we init the engine with the rules on every run
    const rules = await this.getRules();
    await this.initEngine(rules, dynamicFacts);
  }

  async initEngine(
    rules: RuleProperties[] = [],
    dynamicFacts: DynamicFact[] = [],
    options: EngineOptions = { allowUndefinedFacts: true },
  ) {
    this.engine = engineFactory(rules, options);
    await this.loadDynamicFacts(dynamicFacts);
  }

  async run(facts: MemberFacts): Promise<EngineResult> {
    const engineResult = await this.engine.run(facts);
    this.logger.info({ events: engineResult.events }, RulesService.name, this.run.name);
    return engineResult;
  }

  /*************************************************************************************************
   ******************************************** Helpers ********************************************
   ************************************************************************************************/

  private async getRules() {
    const rules = await this.setupRules(engineRules);
    const activeRules = rules.filter((rule) => rule.active);
    return activeRules as RuleProperties[];
  }

  private async setupRules(rules: EngineRule[]) {
    return rules.map((rule) => {
      rule.onSuccess = rule.onSuccess || Callbacks.get(rule.type);
      rule.priority = rule.priority || Priorities.get(rule.type);
      return rule;
    });
  }

  private async loadDynamicFacts(facts: DynamicFact[]) {
    facts.forEach((fact) => {
      this.engine.addFact(fact.id, fact.calculationMethod || fact.value);
    });
  }
}
