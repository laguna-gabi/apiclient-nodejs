import { Injectable } from '@nestjs/common';
import { RulesService } from '../rules';
import { FetcherService } from '../fetcher';
import { StateResolverService } from '../stateResolver';

@Injectable()
export class EngineService {
  constructor(
    private rulesService: RulesService,
    private fetcherService: FetcherService,
    private stateResolverService: StateResolverService,
  ) {}

  async handleEvent(event) {
    const memberId = event.memberId;
    const currentState = await this.fetcherService.fetchData(memberId);
    const engineResult = await this.rulesService.run(currentState);
    // todo: remove (it's just for debugging)
    engineResult.events.map((event) => console.log(event));
    const changes = await this.stateResolverService.calcChanges(engineResult, currentState);
    changes.map((event) => console.log(event));
    await this.fetcherService.applyChanges(changes);
  }
}
