import { Injectable } from '@nestjs/common';

@Injectable()
export class StateResolverService {
  async calcChanges(engineResult, currentState) {
    // todo: calc needed changes:
    // delete actions, create actions, update action
    // for now - retuning the engine result
    return engineResult;
  }
}
