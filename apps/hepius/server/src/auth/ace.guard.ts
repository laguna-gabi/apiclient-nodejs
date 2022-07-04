import { MemberRole, RoleTypes, User, isLagunaUser } from '@argus/hepiusClient';
import { EntityName } from '@argus/pandora';
import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { BaseGuard, EntityResolver } from '.';
import { AceContext, AceOptions, DecoratorType, defaultEntityMemberIdLocator } from '../common';
import { Member } from '../member';
import { ByOrgStrategy } from './strategies/byOrg.strategy';
import { IStrategy } from './strategies/IStrategy';
import { ByMemberStrategy } from './strategies/byMember.strategy';
import { ByTokenStrategy, CustomAceStrategy, RbacStrategy } from './strategies/skip.strategy';
import { ByUserStrategy } from './strategies/byUser.strategy';

@Injectable()
export class AceGuard extends BaseGuard implements CanActivate {
  private readonly defaultStrategy: IStrategy;
  private readonly byMemberStrategy: ByMemberStrategy;
  private byOrgStrategy: ByOrgStrategy;
  private byUserStrategy: ByUserStrategy;
  private byTokenStrategy: ByTokenStrategy;
  private rbacStrategy: RbacStrategy;
  private customAceStrategy: CustomAceStrategy;

  constructor(reflector: Reflector, readonly entityResolver: EntityResolver) {
    super(reflector);
    this.byMemberStrategy = new ByMemberStrategy(this);
    this.byOrgStrategy = new ByOrgStrategy(this);
    this.byUserStrategy = new ByUserStrategy(this);
    this.byTokenStrategy = new ByTokenStrategy();
    this.rbacStrategy = new RbacStrategy();
    this.customAceStrategy = new CustomAceStrategy();
    this.defaultStrategy = this.byMemberStrategy;
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
    if (isPublic) return true;

    const request = await this.getRequest(context);
    const client = request?.user;

    // #1: if user is a Laguna user {(lagunaCoach, lagunaNurse or lagunaAdmin) we can(Activate) - no ACE required
    if (isLagunaUser(client?.roles)) return true;

    // allow both single and multiple strategies
    const strategies =
      typeof aceOptions?.strategy === 'string' ? [aceOptions?.strategy] : aceOptions?.strategy;

    if (!strategies) return this.defaultStrategy.validate({ args, aceOptions }, client);

    // try all strategies - if at least one passed - return true
    for (const strategy of strategies) {
      const validator = this[strategy];
      if ((await validator.validate({ args, aceOptions }, client)) === true) return true;
    }

    return false;
  }

  async getAffectedMemberId(aceContext: AceContext): Promise<string | undefined> {
    if (aceContext.aceOptions) {
      const { idLocator, entityName, entityMemberIdLocator } = aceContext.aceOptions;
      if (idLocator) {
        const entityId = this.getEntityId(aceContext);

        if (entityName === EntityName.member || !entityName) {
          return entityId;
        } else {
          // if the args only carry a non-member entity id we can resolve the member id by fetching the entity
          const entity = await this.entityResolver.getEntityById(entityName, entityId);
          return entity
            ? entity[entityMemberIdLocator || defaultEntityMemberIdLocator]?.toString()
            : undefined;
        }
      }
    }
  }

  getEntityId(aceContext: AceContext): string {
    const {
      args,
      aceOptions: { idLocator },
    } = aceContext;

    const params = Object.values(args)[0];
    if (typeof params === 'string' || Array.isArray(params) || Object.keys(args).length === 0) {
      return args[idLocator];
    } else {
      const paramsName = Object.keys(args)[0];
      return args[paramsName][idLocator];
    }
  }

  // Description: set the org ids in the request args object
  setRequestOrgIds(aceContext: AceContext, orgIds: string[]) {
    const { args, aceOptions } = aceContext;
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
  getRequestOrgIds(aceContext: AceContext): string[] {
    const { args, aceOptions } = aceContext;
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

  isMember(client: { roles?: RoleTypes[] }): boolean {
    return client?.roles?.includes(MemberRole.member);
  }

  getClientProvisionedOrgIds(client): string[] {
    if (this.isMember(client)) {
      return [(client as Member).org.toString()];
    } else {
      return (client as User).orgs.map((org) => org.toString());
    }
  }
}
