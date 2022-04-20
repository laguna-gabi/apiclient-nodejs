import { Injectable, OnModuleInit } from '@nestjs/common';
import engineFactory, {
  Engine,
  EngineOptions,
  EngineResult,
  Fact,
  RuleProperties,
} from 'json-rules-engine';
import { dynamicFacts } from './facts';
import { decisions } from './rules.json';

@Injectable()
export class RulesService implements OnModuleInit {
  private engine: Engine;

  async onModuleInit() {
    // for now - loading rules only once
    // we might want to move it the 'run' method so we init the engine with the rules on every run
    const barrierRules = await this.setupBarrierRules(decisions.barriers);
    const carePlanRules = decisions.carePlans;
    const rules = [...barrierRules, ...carePlanRules];
    await this.initEngine(rules, dynamicFacts);
  }

  async initEngine(
    rules: RuleProperties[] = [],
    // todo: fix fact type
    dynamicFacts: Partial<Fact>[] = [],
    options: EngineOptions = { allowUndefinedFacts: true },
  ) {
    this.engine = engineFactory(rules, options);
    await this.loadDynamicFacts(dynamicFacts);
  }

  async run(facts): Promise<EngineResult> {
    return this.engine.run(facts);
  }

  async loadDynamicFacts(facts: Partial<Fact>[]) {
    facts.forEach((fact) => {
      this.engine.addFact(fact.id, fact.calculationMethod);
    });
  }

  async setupBarrierRules(rules: RuleProperties[]) {
    return rules.map((rule) => {
      rule.onSuccess = async (event, almanac) => {
        const newBarriers = await almanac.factValue('newBarriers');
        const updatedBarriers = newBarriers
          ? // remove when defining types
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore
            newBarriers.push(event.params.type)
          : [event.params.type];
        almanac.addRuntimeFact('newBarriers', updatedBarriers);
      };
      rule.priority = 10;
      return rule;
    });
  }
}
