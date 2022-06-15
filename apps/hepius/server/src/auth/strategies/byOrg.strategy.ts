import { AceContext } from '../../common';
import { AceGuard } from '../ace.guard';
import { difference, isEqual, sortBy } from 'lodash';
import { IStrategy } from './IStrategy';

/**
 * Strategy to use when performing broader actions on multiple members.
 * Relying on org filtering in the service or resolver level.
 * Populating the orgIds with the provisionedOrgIds when it's empty.
 * Allowed to perform actions in 2 cases:
 * 1. It's the member itself performing actions on his own org
 * 2. It's the user, performing actions on it's provisionedOrgIds.
 */
export class ByOrgStrategy implements IStrategy {
  constructor(readonly aceGuard: AceGuard) {}

  async validate(aceContext: AceContext, client): Promise<boolean> {
    const orgIds = this.aceGuard.getRequestOrgIds(aceContext);
    const provisionedOrgIds = this.aceGuard.getClientProvisionedOrgIds(client);
    // if org id(s) are not set we populate request args with member/user provisioned org ids (support ALL orgs)
    if (!orgIds?.length) {
      this.aceGuard.setRequestOrgIds(aceContext, provisionedOrgIds);
      return true;
    } else {
      if (this.aceGuard.isMember(client)) {
        return isEqual(sortBy(orgIds), sortBy(provisionedOrgIds));
      } else {
        return difference(orgIds, provisionedOrgIds).length === 0;
      }
    }
  }
}
