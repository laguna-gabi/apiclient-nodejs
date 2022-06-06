import { MemberRole } from '@argus/hepiusClient';
import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { GqlExecutionContext } from '@nestjs/graphql';
import { Observable } from 'rxjs';
import { DecoratorType, ErrorType, Errors } from '.';

/**
 * There are 2 ways to pass params to gql:
 * 1. using DTO(Data transfer object) (like CreateUserParams)
 * 2. Independent param (like memberId)
 * When there's just one param, the args would look like {"memberId": <id>},
 * When there's a DTO, the args would look like {"createUserParams": {<params>}}.
 * For each situation we need to change the memberId in different params.
 * But there are also two types of memberId in params:
 * it can come as id and as memberId.
 * to change the right parameter we add another decorator @MemberIdParam()
 * and there we specify what parameter is the memberId `memberId` or `id`.
 * Then we extract that metadata using the Reflector.
 * !! The order of the decorators is important !!
 * first add the metadata @MemberIdParam() and then the MemberUserRouteInterceptor.
 */
@Injectable()
export class MemberUserRouteInterceptor implements NestInterceptor<void> {
  constructor(private reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<void> {
    const params = Object.values(context.getArgByIndex(1))[0];
    const { _id: clientId, roles: clientRoles } =
      GqlExecutionContext.create(context).getContext().req.user;

    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    const memberId: string = this.reflector.get<string[]>(
      DecoratorType.memberId,
      context.getHandler(),
    );
    if (!memberId) {
      throw new Error(Errors.get(ErrorType.memberIdMetadataMissing));
    }

    if (
      typeof params === 'string' ||
      Array.isArray(params) ||
      Object.keys(context.getArgByIndex(1)).length === 0
    ) {
      // params
      if (clientRoles.includes(MemberRole.member)) {
        context.getArgByIndex(1)[memberId] = clientId.toString();
      } else if (!context.getArgByIndex(1)[memberId]) {
        throw new Error(Errors.get(ErrorType.memberIdInvalid));
      }
    } else {
      // DTO
      const paramsName = Object.keys(context.getArgByIndex(1))[0];
      if (clientRoles.includes(MemberRole.member)) {
        context.getArgByIndex(1)[paramsName][memberId] = clientId.toString();
      } else if (!context.getArgByIndex(1)[paramsName][memberId]) {
        throw new Error(Errors.get(ErrorType.memberIdInvalid));
      }
    }

    return next.handle();
  }
}
