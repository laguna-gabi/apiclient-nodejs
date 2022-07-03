import { IStrategy } from './IStrategy';

/**
 * Strategy to use for cases when we want to pass the responsibility to the resolver
 */
export class SkipStrategy implements IStrategy {
  async validate(): Promise<boolean> {
    return true;
  }
}

export class ByTokenStrategy extends SkipStrategy {}
export class RbacStrategy extends SkipStrategy {}
export class CustomAceStrategy extends SkipStrategy {}
