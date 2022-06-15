import { Platform } from '@argus/pandora';
import { Field, InputType } from '@nestjs/graphql';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { IsEnum, IsNotEmpty, IsSemVer, IsString } from 'class-validator';

/**************************************************************************************************
 ***************************************** Input params *******************************************
 *************************************************************************************************/
@InputType()
export class CreateMobileVersionParams {
  @Field(() => String)
  @IsSemVer()
  version: string;

  @Field(() => Platform)
  platform: Platform;

  @Field(() => Boolean, { nullable: true })
  minVersion?: boolean;
}

@InputType()
export class UpdateMinMobileVersionParams {
  @Field(() => String)
  @IsSemVer()
  version: string;

  @Field(() => Platform)
  platform: Platform;
}

@InputType()
export class UpdateFaultyMobileVersionsParams {
  @Field(() => [String])
  @IsSemVer({ each: true })
  versions: string[];

  @Field(() => Platform)
  platform: Platform;
}

export class CheckMobileVersionParams {
  @IsNotEmpty()
  @IsString()
  @IsSemVer()
  version: string;

  @IsNotEmpty()
  @IsString()
  build: string;

  @IsNotEmpty()
  @IsString()
  @IsEnum(Platform)
  platform: Platform;
}

/**************************************************************************************************
 ****************************************** Return params *****************************************
 *************************************************************************************************/
export class CheckMobileVersionResponse {
  latestVersion: string;

  forceUpdate: boolean;

  updateAvailable: boolean;
}

@Schema({ versionKey: false, timestamps: true })
export class MobileVersion {
  @Prop()
  version: string;

  @Prop({ type: String, enum: Platform })
  platform: Platform;

  @Prop({ type: Boolean, default: false })
  minVersion: boolean;

  @Prop({ type: Boolean, default: false })
  faultyVersion: boolean;
}

/**************************************************************************************************
 **************************************** Exported Schemas ****************************************
 *************************************************************************************************/
export type MobileVersionDocument = MobileVersion & Document;
export const MobileVersionDto = SchemaFactory.createForClass(MobileVersion).index(
  { version: 1, platform: 1 },
  { unique: true },
);
