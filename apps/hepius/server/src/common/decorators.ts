import { ExecutionContext, SetMetadata, createParamDecorator } from '@nestjs/common';
import { GqlContextType, GqlExecutionContext } from '@nestjs/graphql';
import { AceOptions, MemberIdParamType } from '.';

export enum DecoratorType {
  isPublic = 'isPublic',
  roles = 'roles',
  aceOptions = 'aceOptions',
  memberId = 'memberId',
}
export const Public = () => SetMetadata(DecoratorType.isPublic, true);

export const Roles = (...roles: string[]) => SetMetadata(DecoratorType.roles, roles);

export const MemberIdParam = (memberId: MemberIdParamType) =>
  SetMetadata(DecoratorType.memberId, memberId);

export const Ace = (aceOptions: AceOptions) => SetMetadata(DecoratorType.aceOptions, aceOptions);

export const Client = createParamDecorator((data: string, context: ExecutionContext) => {
  let request;

  if (context.getType<GqlContextType>() === 'graphql') {
    const ctx = GqlExecutionContext.create(context);
    request = ctx.getContext().req;
  } else {
    request = context.switchToHttp().getRequest();
  }
  const user = request.user;
  return data ? user?.[data] : user;
});
