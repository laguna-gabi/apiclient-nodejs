import { MemberRole, User, UserRole } from '@argus/hepiusClient';
import { EntityName } from '@argus/pandora';
import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Types } from 'mongoose';
import { BaseGuard, EntityResolver } from '.';
import { AceOptions, DecoratorType, defaultEntityMemberIdLocator } from '../common';
import { Member } from '../member';

@Injectable()
export class AceGuard extends BaseGuard implements CanActivate {
  constructor(reflector: Reflector, readonly entityResolver: EntityResolver) {
    super(reflector);
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // `rpc` type requests are managed via the TCP Auth. Interceptor
    if (context.getType() === 'rpc') {
      return true;
    }

    const isPublic = this.reflector.get<boolean>(DecoratorType.isPublic, context.getHandler());
    const aceOptions = this.reflector.get<AceOptions>(
      DecoratorType.aceOptions,
      context.getHandler(),
    );
    const args = context.getArgByIndex(1); // request args

    // #0: ACE is skipped if handler is marked as public
    if (isPublic) {
      return true;
    }

    const request = await this.getRequest(context);

    const client: User = request?.user as User;

    // #1: if user is a Laguna user {(coach, nurse or admin) we can(Activate) - no ACE required
    if (
      client.roles.find((role) =>
        [UserRole.lagunaCoach, UserRole.lagunaAdmin, UserRole.lagunaNurse].includes(
          role as UserRole,
        ),
      )
    ) {
      return true;
    }

    // obtain the member id affected by the resolver
    const memberId = await this.getAffectedMemberId(args, aceOptions);

    // #2: if client is a Member we should allow access only to self
    // Note: if member id is empty we rely on an interceptor to set the `memberId`,
    if (this.isMember(client)) {
      return (memberId && client.id === memberId) || !memberId;
    } else {
      // #3: if client is a user we allow/deny access based on org provisioning
      if (Types.ObjectId.isValid(memberId)) {
        const member = await this.entityResolver.getEntityById(Member.name, memberId);
        return !!client.orgs?.find((org) => org.toString() === member?.org.id);
      }
    }
  }

  // Description: get the request affected member id
  // The method will fetch the member id from request args or from an entity associated
  // with a member - for example: in a request to change an appointment by id we will
  // fetch the appointment using the entity resolver and obtain the member id fro within the
  // the appointment document
  private async getAffectedMemberId(args, aceOptions: AceOptions): Promise<string | undefined> {
    let entityId: string;

    if (aceOptions) {
      if (aceOptions.idLocator) {
        const params = Object.values(args)[0];
        if (typeof params === 'string' || Array.isArray(params) || Object.keys(args).length === 0) {
          entityId = args[aceOptions.idLocator];
        } else {
          const paramsName = Object.keys(args)[0];
          entityId = args[paramsName][aceOptions.idLocator];
        }

        if (aceOptions.entityName === EntityName.member) {
          return entityId;
        } else {
          // if the args only carry a non-member entity id we can resolve the member id by fetching the entity
          const entity = await this.entityResolver.getEntityById(aceOptions.entityName, entityId);
          return entity
            ? entity[aceOptions.entityMemberIdLocator || defaultEntityMemberIdLocator]
            : undefined;
        }
      }
    }
  }

  isMember(client: { roles?: string[] }): boolean {
    return client?.roles?.includes(MemberRole.member);
  }
}
