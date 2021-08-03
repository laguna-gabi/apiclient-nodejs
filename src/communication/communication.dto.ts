import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

/**************************************************************************************************
 **************************************** Internal params *****************************************
 *************************************************************************************************/
export interface RegisterSendbirdUserParams {
  user_id: string;
  nickname: string;
  profile_url: string;
  metadata: any;
}

export interface CreateSendbirdGroupChannelParams {
  name: string;
  channel_url: string;
  cover_url: string;
  inviter_id: string;
  user_ids: string[];
}

/**************************************************************************************************
 ********************************* Return params for gql methods **********************************
 *************************************************************************************************/
@Schema({ versionKey: false, timestamps: true })
export class Communication {
  @Prop({ index: true })
  memberId: string;

  @Prop({ index: true })
  userId: string;

  @Prop({ index: true, unique: true })
  sendbirdChannelUrl: string;
}

/**************************************************************************************************
 **************************************** Exported Schemas ****************************************
 *************************************************************************************************/
export type CommunicationDocument = Communication & Document;
export const CommunicationDto = SchemaFactory.createForClass(Communication);
