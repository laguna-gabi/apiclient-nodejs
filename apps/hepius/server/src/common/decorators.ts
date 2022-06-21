import { User } from '@argus/hepiusClient';
import { ExecutionContext, SetMetadata, createParamDecorator } from '@nestjs/common';
import { GqlContextType, GqlExecutionContext } from '@nestjs/graphql';
import { pick } from 'lodash';
import { AceOptions, MemberIdParamType } from '.';
import { Member } from '../member';

export enum DecoratorType {
  isPublic = 'isPublic',
  roles = 'roles',
  aceOptions = 'aceOptions',
  memberId = 'memberId',
}

type keyOfMember = keyof Member | '_id';
type keyOfUser = keyof User | '_id';

export const Public = () => SetMetadata(DecoratorType.isPublic, true);

export const Roles = (...roles: string[]) => SetMetadata(DecoratorType.roles, roles);

export const MemberIdParam = (memberId: MemberIdParamType) =>
  SetMetadata(DecoratorType.memberId, memberId);

export const Ace = (aceOptions: AceOptions) => SetMetadata(DecoratorType.aceOptions, aceOptions);

const getRequestFromCtx = (context: ExecutionContext): { user?: User | Member } => {
  if (context.getType<GqlContextType>() === 'graphql') {
    const ctx = GqlExecutionContext.create(context);
    return ctx.getContext().req;
  } else {
    return context.switchToHttp().getRequest();
  }
};

export const Client = createParamDecorator(
  (data: keyOfMember | keyOfUser, context: ExecutionContext) => {
    const { user } = getRequestFromCtx(context);
    return data ? user?.[data] : user;
  },
);

export const ClientSpread = createParamDecorator(
  (data: keyOfMember[] | keyOfUser[] = [], context: ExecutionContext): Partial<User | Member> => {
    const { user } = getRequestFromCtx(context);
    return data.length && user ? pick(user, data) : user;
  },
);
