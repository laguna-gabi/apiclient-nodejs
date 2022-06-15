import { AceContext } from '../../common';
import { AceGuard } from '../ace.guard';
import { IStrategy } from './IStrategy';
import { Types } from 'mongoose';
import { User, isLagunaUser } from '@argus/hepiusClient';
import { intersection } from 'lodash';

/**
 * Strategy to use when performing actions on users.
 * !USE ONLY ON QUERIES AND NOT MUTATIONS!
 * Allowed to get information on users in 2 cases:
 * 1. It's a user trying to get information on a user from his org
 * 2. It's a user trying to get information on a laguna user
 */
export class ByUserStrategy implements IStrategy {
  constructor(readonly aceGuard: AceGuard) {}

  async validate(aceContext: AceContext, client): Promise<boolean> {
    if (aceContext.aceOptions?.idLocator) {
      // obtain the user id affected by the resolver
      const userId = this.aceGuard.getEntityId(aceContext);
      const user = await this.aceGuard.entityResolver.getEntityById(User.name, userId);
      if (!user) return false;

      // allow getting info on laguna users
      if (isLagunaUser(user?.roles) && !this.aceGuard.isMember(client)) return true;

      // allow/deny access based on org provisioning
      if (Types.ObjectId.isValid(userId)) {
        const targetUserOrgs = user.orgs.map((org) => org.toString());
        const provisionedOrgIds = this.aceGuard.getClientProvisionedOrgIds(client);
        return intersection(provisionedOrgIds, targetUserOrgs)?.length > 0;
      }
    }
  }
}
