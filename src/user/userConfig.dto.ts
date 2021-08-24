import { Field, ObjectType } from '@nestjs/graphql';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

/**************************************************************************************************
 ********************************* Return params for gql methods **********************************
 *************************************************************************************************/

@ObjectType()
@Schema({ versionKey: false, timestamps: true })
export class UserConfig {
  @Prop({ type: String, unique: true, index: true })
  @Field(() => String)
  userId: string;

  @Prop()
  @Field(() => String)
  accessToken: string;
}

/**************************************************************************************************
 **************************************** Exported Schemas ****************************************
 *************************************************************************************************/
export type UserConfigDocument = UserConfig & Document;
export const UserConfigDto = SchemaFactory.createForClass(UserConfig);
