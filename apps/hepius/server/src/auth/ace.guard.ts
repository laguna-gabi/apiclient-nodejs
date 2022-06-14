import { MemberRole, RoleTypes, User, isLagunaUser } from '@argus/hepiusClient';
import { EntityName } from '@argus/pandora';
import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Types } from 'mongoose';
import { BaseGuard, EntityResolver } from '.';
import { AceOptions, AceStrategy, DecoratorType, defaultEntityMemberIdLocator } from '../common';
import { Member } from '../member';
import { difference, isEqual, sortBy } from 'lodash';
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
    if (
      isPublic ||
      aceOptions?.strategy === AceStrategy.token ||
      aceOptions?.strategy === AceStrategy.rbac ||
      aceOptions?.strategy === AceStrategy.custom
    ) {
      return true;
    }

    const request = await this.getRequest(context);

    const client = request?.user;

    // #1: if user is a Laguna user {(lagunaCoach, lagunaNurse or lagunaAdmin) we can(Activate) - no ACE required
    if (isLagunaUser(client?.roles)) {
      return true;
    }

    switch (aceOptions?.strategy) {
      case AceStrategy.byOrg:
        const orgIds = this.getRequestOrgIds(args, aceOptions);
        const provisionedOrgIds = this.getClientProvisionedOrgIds(client);
        // if org id(s) are not set we populate request args with member/user provisioned org ids (support ALL orgs)
        if (!orgIds?.length) {
          this.setRequestOrgIds(args, aceOptions, provisionedOrgIds);
          return true;
        } else {
          if (this.isMember(client)) {
            return isEqual(sortBy(orgIds), sortBy(provisionedOrgIds));
          } else {
            return difference(orgIds, provisionedOrgIds).length === 0;
          }
        }

      default:
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
            return !!client.orgs?.find((org) => org.toString() === member?.org.toString());
          }
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
            ? entity[aceOptions.entityMemberIdLocator || defaultEntityMemberIdLocator]?.toString()
            : undefined;
        }
      }
    }
  }

  // Description: set the org ids in the request args object
  private setRequestOrgIds(args, aceOptions: AceOptions, orgIds: string[]) {
    if (aceOptions && aceOptions.idLocator) {
      const params = Object.values(args)[0];
      if (typeof params === 'string' || Array.isArray(params) || Object.keys(args).length === 0) {
        args[aceOptions.idLocator] = orgIds;
      } else {
        const paramsName = Object.keys(args)[0];
        args[paramsName][aceOptions.idLocator] = orgIds;
      }
    }
  }

  // Description: get the org ids from the request
  private getRequestOrgIds(args, aceOptions: AceOptions): string[] {
    let extractedParamsValue;
    if (aceOptions && aceOptions.idLocator) {
      const params = Object.values(args)[0];
      if (typeof params === 'string' || Array.isArray(params) || Object.keys(args).length === 0) {
        extractedParamsValue = args[aceOptions.idLocator];
      } else {
        const paramsName = Object.keys(args)[0];
        extractedParamsValue = args[paramsName][aceOptions.idLocator];
      }
    }

    // supporting both string and string[]
    return typeof extractedParamsValue === 'string' ? [extractedParamsValue] : extractedParamsValue;
  }

  private isMember(client: { roles?: RoleTypes[] }): boolean {
    return client?.roles?.includes(MemberRole.member);
  }

  private getClientProvisionedOrgIds(client): string[] {
    if (this.isMember(client)) {
      return [(client as Member).org.toString()];
    } else {
      return (client as User).orgs.map((org) => org.toString());
    }
  }
}
