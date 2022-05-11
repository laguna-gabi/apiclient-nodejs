import { Injectable } from '@nestjs/common';

@Injectable()
export class StateResolverService {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async calcChanges(engineResult, currentState) {
    // todo: calc needed changes:
    // delete actions, create actions, update action
    // for now - retuning the engine result
    return engineResult;
  }
}
