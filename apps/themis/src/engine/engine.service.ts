import { Injectable } from '@nestjs/common';
import { RulesService } from '../rules';
import { FetcherService } from '../fetcher';
import { StateResolverService } from '../stateResolver';
import { IChangeEvent } from '@argus/pandora';
import { EventType } from '../common';
import { OnEvent } from '@nestjs/event-emitter';

@Injectable()
export class EngineService {
  constructor(
    private rulesService: RulesService,
    private fetcherService: FetcherService,
    private stateResolverService: StateResolverService,
  ) {}

  @OnEvent(EventType.onChangeEvent, { async: false })
  async handleEvent(event: IChangeEvent) {
    const memberId = event.memberId;
    const memberFacts = await this.fetcherService.fetchData(memberId);
    const engineResult = await this.rulesService.run(memberFacts);
    // todo: remove (it's just for debugging)
    engineResult.events.map((event) => console.log(event));
    const engineActions = await this.stateResolverService.calcChanges(engineResult, memberFacts);
    engineActions.map((event) => console.log(event));
    await this.fetcherService.applyChanges(engineActions);
  }
}
