import { IStrategy } from './IStrategy';
import { AceContext } from '../../common';

/**
 * Strategy to use for cases when we want to pass the responsibility to the resolver
 */
export class SkipStrategy implements IStrategy {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async validate(aceContext: AceContext, client): Promise<boolean> {
    return true;
  }
}

export class ByTokenStrategy extends SkipStrategy {}
export class RbacStrategy extends SkipStrategy {}
export class CustomAceStrategy extends SkipStrategy {}
