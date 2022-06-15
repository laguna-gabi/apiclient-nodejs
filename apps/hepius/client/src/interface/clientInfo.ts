import { Field, ObjectType, registerEnumType } from '@nestjs/graphql';

import { Identifier } from '.';

export enum RoleSummary {
  laguna = 'laguna',
  coach = 'coach',
  member = 'member',
}

registerEnumType(RoleSummary, { name: 'RoleSummary' });

@ObjectType()
export class ClientInfo extends Identifier {
  @Field(() => String, { nullable: true })
  firstName?: string;

  @Field(() => String, { nullable: true })
  lastName?: string;

  @Field(() => RoleSummary, { nullable: true })
  role?: RoleSummary;
}
