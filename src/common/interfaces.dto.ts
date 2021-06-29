import { Field, ObjectType } from '@nestjs/graphql';
import { Schema } from '@nestjs/mongoose';

@ObjectType()
@Schema()
export class Id {
  @Field(() => String)
  id: string;
}
