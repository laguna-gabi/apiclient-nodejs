/**************************************************************************************************
 ******************************* Enum registration for gql methods ********************************
 *************************************************************************************************/
import { Field, ObjectType, OmitType, registerEnumType } from '@nestjs/graphql';
import { Prop, Schema } from '@nestjs/mongoose';
import { Identifier } from './common';
import { Types } from 'mongoose';
import { Notes } from './notes.dto';

export enum AppointmentStatus {
  requested = 'requested',
  scheduled = 'scheduled',
  done = 'done',
}

registerEnumType(AppointmentStatus, { name: 'AppointmentStatus' });

export enum AppointmentMethod {
  chat = 'chat',
  phoneCall = 'phoneCall',
  videoCall = 'videoCall',
}
registerEnumType(AppointmentMethod, { name: 'AppointmentMethod' });

/**************************************************************************************************
 ********************************* Return params for gql methods **********************************
 *************************************************************************************************/
@ObjectType()
@Schema({ versionKey: false, timestamps: true })
export class Appointment extends Identifier {
  @Prop({ index: true, type: Types.ObjectId })
  @Field(() => String)
  userId: Types.ObjectId;

  @Prop({ index: true, type: Types.ObjectId })
  @Field(() => String)
  memberId: Types.ObjectId;

  @Prop({ isNaN: true })
  @Field(() => Date, { nullable: true })
  notBefore: Date;

  @Prop({ type: String, enum: AppointmentStatus })
  @Field(() => AppointmentStatus)
  status: AppointmentStatus;

  @Prop({ type: String, enum: AppointmentMethod })
  @Field(() => AppointmentMethod, { nullable: true })
  method?: AppointmentMethod;

  @Prop()
  @Field(() => Date, { nullable: true })
  start?: Date;

  @Prop()
  @Field(() => Date, { nullable: true })
  end?: Date;

  @Prop({ isNan: true })
  @Field(() => Boolean, { nullable: true })
  noShow?: boolean;

  @Prop({ isNaN: true })
  @Field(() => String, { nullable: true })
  noShowReason?: string;

  @Prop({ isNaN: true })
  @Field(() => Boolean, { nullable: true })
  recordingConsent?: boolean;

  @Prop({ type: Types.ObjectId, ref: Notes.name })
  @Field(() => Notes, { nullable: true })
  notes?: Notes;

  @Field(() => Date)
  updatedAt: Date;

  @Field(() => Date)
  createdAt: Date;

  @Prop()
  @Field(() => String)
  link: string;
}

@ObjectType()
export class AppointmentData extends OmitType(Appointment, ['userId', 'memberId']) {}
