import { Field, ObjectType } from '@nestjs/graphql';
import { Schema } from '@nestjs/mongoose';

@ObjectType()
@Schema()
export class Id {
  //TODO _id + id in mongodb
  //TODO define prop which works with get/insert
  //TODO add required
  @Field(() => String, { description: 'member id' })
  // @Prop({ type: mongoose.Types.ObjectId })
  // @Prop()
  _id: string;
}
