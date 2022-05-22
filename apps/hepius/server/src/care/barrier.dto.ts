import { Field, InputType, registerEnumType } from '@nestjs/graphql';
import { SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { ErrorType, Errors } from '../common';
import * as mongooseDelete from 'mongoose-delete';
import { ISoftDelete, audit, useFactoryOptions } from '../db';
import { Barrier, BarrierDomain, BarrierType, CareStatus, IsObjectId } from '@argus/hepiusClient';

registerEnumType(CareStatus, { name: 'CareStatus' });
registerEnumType(BarrierDomain, { name: 'BarrierCategory' });
/**************************************************************************************************
 ********************************** Input params for gql methods **********************************
 *************************************************************************************************/

@InputType()
export class BaseBarrierParams {
  @Field(() => String)
  @IsObjectId({ message: Errors.get(ErrorType.barrierTypeInvalid) })
  type: string;

  @Field(() => String, { nullable: true })
  notes?: string;
}

@InputType()
export class CreateBarrierParams extends BaseBarrierParams {
  @Field(() => String, { nullable: true })
  @IsObjectId({ message: Errors.get(ErrorType.redFlagIdInvalid) })
  redFlagId?: string;

  @Field(() => String)
  @IsObjectId({ message: Errors.get(ErrorType.memberIdInvalid) })
  memberId: string;
}

@InputType()
export class UpdateBarrierParams {
  @Field(() => String)
  @IsObjectId({ message: Errors.get(ErrorType.barrierIdInvalid) })
  id: string;

  @Field(() => String, { nullable: true })
  notes?: string;

  @Field(() => CareStatus, { nullable: true })
  status?: CareStatus;

  @Field(() => String, { nullable: true })
  @IsObjectId({ message: Errors.get(ErrorType.barrierTypeInvalid) })
  type?: string;
}

/**************************************************************************************************
 **************************************** Exported Schemas ****************************************
 *************************************************************************************************/
export type BarrierDocument = Barrier & Document & ISoftDelete<BarrierType>;
export const BarrierDto = audit(
  SchemaFactory.createForClass(Barrier).plugin(mongooseDelete, useFactoryOptions),
);

export type BarrierTypeDocument = BarrierType & Document;
export const BarrierTypeDto = audit(
  SchemaFactory.createForClass(BarrierType).plugin(mongooseDelete, useFactoryOptions),
);
