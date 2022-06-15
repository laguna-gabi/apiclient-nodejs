import { AceContext } from '../../common';
import { AceGuard } from '../ace.guard';
import { IStrategy } from './IStrategy';
import { Types } from 'mongoose';
import { Member } from '../../member';
import { Journey } from '../../journey';

/**
 * Strategy to use when performing actions on member or member related entities.
 * Allowed to perform actions on member in 2 cases:
 * 1. It's the member itself performing actions on himself
 * 2. It's the user from the same org as the member.
 */
export class ByMemberStrategy implements IStrategy {
  constructor(readonly aceGuard: AceGuard) {}

  async validate(aceContext: AceContext, client): Promise<boolean> {
    // obtain the member id affected by the resolver
    const memberId = await this.aceGuard.getAffectedMemberId(aceContext);

    // #2: if client is a Member we should allow access only to self
    // Note: if member id is empty we rely on an interceptor to set the `memberId`,
    if (this.aceGuard.isMember(client)) {
      return (memberId && client.id === memberId) || !memberId;
    } else {
      // #3: if client is a user we allow/deny access based on org provisioning
      if (Types.ObjectId.isValid(memberId)) {
        const member = await this.aceGuard.entityResolver.getEntityById(Member.name, memberId);
        const journeys = await this.aceGuard.entityResolver.getEntities<Journey>(Journey.name, {
          filter: { memberId: new Types.ObjectId(member._id) },
          sort: { _id: -1 },
          limit: 1,
        });
        if (!journeys || journeys.length === 0) {
          return false;
        }

        return !!client.orgs?.find((org) => org.toString() === journeys[0].org.toString());
      }
    }
  }
}
