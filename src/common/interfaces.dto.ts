import { Field, ObjectType } from '@nestjs/graphql';
import { Schema } from '@nestjs/mongoose';

@ObjectType()
@Schema()
export class Identifier {
  @Field(() => String)
  id: string;
}
