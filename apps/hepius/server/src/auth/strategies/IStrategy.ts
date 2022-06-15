import { AceContext } from '../../common';

export interface IStrategy {
  validate(aceContext: AceContext, client): Promise<boolean>;
}
