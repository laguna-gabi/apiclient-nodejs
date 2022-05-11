import { Language } from '@argus/pandora';
import { Field, ObjectType } from '@nestjs/graphql';
import { Prop, Schema } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { Appointment, AppointmentData } from './appointment.dto';
import { Identifier } from './common';
import { UserRole } from './roles';

export const defaultUserParams = {
  maxMembers: 7,
  languages: [Language.en],
  roles: [UserRole.coach],
  avatar: 'https://i.imgur.com/bvuKGXB.png',
};

/**************************************************************************************************
 ********************************* Return params for gql methods **********************************
 *************************************************************************************************/

@ObjectType()
@Schema({ versionKey: false, timestamps: true })
export class User extends Identifier {
  @Prop()
  @Field(() => String, { nullable: true })
  authId?: string;

  @Prop()
  @Field(() => String)
  firstName: string;

  @Prop()
  @Field(() => String)
  lastName: string;

  @Prop({ unique: true })
  @Field(() => String)
  email: string;

  @Prop({ default: defaultUserParams.roles })
  @Field(() => [UserRole], {
    description: 'role of the user: admin/user/nurse/nutrition/doctor/...',
  })
  roles: UserRole[];

  @Prop({ default: defaultUserParams.avatar })
  @Field(() => String, { nullable: true })
  avatar?: string;

  @Prop({ type: [{ type: Types.ObjectId, ref: Appointment.name }] })
  @Field(() => [AppointmentData], { nullable: true })
  appointments?: AppointmentData[];

  @Prop({ isNaN: true })
  @Field(() => String, { nullable: true })
  description?: string;

  @Field(() => Date)
  createdAt: Date;

  @Prop()
  @Field(() => String)
  phone: string;

  @Prop({ isNaN: true })
  @Field({ nullable: true })
  title?: string;

  @Prop({ default: defaultUserParams.maxMembers })
  @Field(() => Number)
  maxMembers?: number;

  @Prop({ default: defaultUserParams.languages })
  @Field(() => [Language], { nullable: true })
  languages?: Language[];

  @Prop()
  @Field(() => Date, { nullable: true })
  lastQueryAlert: Date;

  @Prop({ isNaN: true })
  @Field(() => Boolean, { nullable: true })
  inEscalationGroup?: boolean;

  @Prop({ type: [{ type: Types.ObjectId }] })
  @Field(() => [String])
  orgs: string[];

  /**
   * we use that start of time (new Date(0)) for the default time for
   * lastMemberAssignedAt so a new user will get the next new member.
   */
  @Prop()
  lastMemberAssignedAt: Date;
}
