import { Injectable, OnModuleInit } from '@nestjs/common';
import { Engine } from 'json-rules-engine';
import { memberBarriers, memberCaregivers, memberData } from './facts';

@Injectable()
export class RuleEngineService implements OnModuleInit {
  private engine: Engine;

  async onModuleInit() {
    // do we want to init the engine once or on every run?
    this.engine = new Engine([], { allowUndefinedFacts: true });
    await this.loadRules();
    await this.loadDynamicFacts();
  }

  async start(facts) {
    return this.engine.run(facts);
  }

  async loadRules() {
    const appointmentFollowupRule = {
      conditions: {
        all: [
          {
            fact: 'member-info',
            operator: 'equal',
            value: 0,
            path: '$.scheduledAppointments',
          },
          {
            fact: 'member-info',
            operator: 'equal',
            value: 0,
            path: '$.appointmentsToBeScheduled',
          },
        ],
      },
      event: {
        type: 'create-barrier',
        params: {
          type: 'appointment-follow-up-unclear',
        },
      },
      priority: 10,
    };
    this.engine.addRule(appointmentFollowupRule);

    const lonelinessRule = {
      conditions: {
        any: [
          {
            fact: 'member-info',
            operator: 'equal',
            value: true,
            path: '$.livesAlone',
          },
          {
            fact: 'member-caregivers-count',
            operator: 'lessThan',
            value: 2,
          },
        ],
      },
      event: {
        type: 'create-barrier',
        params: {
          type: 'loneliness',
        },
      },
      priority: 10,
    };
    this.engine.addRule(lonelinessRule);

    const basicPocRule = {
      conditions: {
        any: [
          {
            fact: 'member-barriers-types',
            operator: 'contains',
            value: 'loneliness',
          },
          {
            fact: 'member-new-barriers',
            operator: 'contains',
            value: 'loneliness',
          },
        ],
      },
      event: {
        type: 'create-poc',
        params: {
          type: 'content-about-combating-loneliness',
        },
      },
      priority: 1,
    };
    this.engine.addRule(basicPocRule);

    const unknownRule = {
      conditions: {
        all: [
          {
            fact: 'unknown',
            operator: 'equal',
            value: 'loneliness',
          },
        ],
      },
      event: {
        type: 'unknown',
        params: {
          type: 'content-about-combating-loneliness',
        },
      },
      priority: 1,
    };
    this.engine.addRule(unknownRule);
  }

  async loadDynamicFacts() {
    // let facts
    this.engine.on('success', async (event, almanac) => {
      // console.log(facts.memberId + ' DID '.green + 'meet conditions for the ' + event.type.underline + ' rule:' + event.params.type.underline)
      if (event.type === 'create-barrier') {
        const barrierTypes = await almanac.factValue('member-new-barriers');
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        const newTypes = barrierTypes ? barrierTypes.push(event.params.type) : [event.params.type];
        almanac.addRuntimeFact('member-new-barriers', newTypes);
      }
    });
    // .on('failure', event => {
    //     console.log(facts.memberId + ' did ' + 'NOT'.red + ' meet conditions for the ' + event.type.underline + ' rule:' + event.params.type.underline || event.params.type.underline)
    // })

    /**
     * 'account-information' fact executes an api call and retrieves account data
     * - Demonstrates facts called only by other facts and never mentioned directly in a rule
     */
    this.engine.addFact('member-info', (params, almanac) => {
      return almanac.factValue('memberId').then((memberId) => {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        return memberData[memberId];
      });
    });

    this.engine.addFact('member-caregivers', (params, almanac) => {
      return almanac.factValue('memberId').then((memberId) => {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        return memberCaregivers[memberId];
      });
    });

    this.engine.addFact('member-barriers', (params, almanac) => {
      return almanac.factValue('memberId').then((memberId) => {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        return memberBarriers[memberId];
      });
    });

    this.engine.addFact('member-barriers-types', (params, almanac) => {
      return almanac.factValue('member-barriers').then((barriers) => {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        return barriers.map((barrier) => barrier.type);
      });
    });

    this.engine.addFact('member-caregivers-count', (params, almanac) =>
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      almanac.factValue('member-caregivers').then((result) => result.length),
    );

    this.engine.addFact('member-new-barriers', []);
    // first run, using washington's facts
  }
}

// async function main() {
//   const ruleEngine = new RuleEngine()
//   const facts = { memberId: '11111' }
//   const results = await ruleEngine.start(facts)
// }
//
// main();
//
// }
