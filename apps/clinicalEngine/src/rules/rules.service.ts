import { Injectable, OnModuleInit } from '@nestjs/common';
import engineFactory, {
  Engine,
  EngineOptions,
  EngineResult,
  RuleProperties,
} from 'json-rules-engine';
import { dynamicFacts, updateNewBarriersFact } from './facts';
import { DynamicFact, EngineRule, Priority } from './types';
import { engineRules } from './rules';

@Injectable()
export class RulesService implements OnModuleInit {
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

  async run(facts): Promise<EngineResult> {
    return this.engine.run(facts);
  }

  /*************************************************************************************************
   ******************************************** Helpers ********************************************
   ************************************************************************************************/

  async getRules() {
    const barrierRules = await this.setupBarrierRules(engineRules.barriers);
    const carePlanRules = engineRules.carePlans;
    const rules = [...barrierRules, ...carePlanRules].filter((rule) => rule.active);
    // todo: is there a better solution?
    return rules as RuleProperties[];
  }

  async setupBarrierRules(rules: EngineRule[]) {
    return rules.map((rule) => {
      rule.onSuccess = updateNewBarriersFact;
      rule.priority = Priority.barrier;
      return rule;
    });
  }

  async loadDynamicFacts(facts: DynamicFact[]) {
    facts.forEach((fact) => {
      this.engine.addFact(fact.id, fact.calculationMethod);
    });
  }
}
