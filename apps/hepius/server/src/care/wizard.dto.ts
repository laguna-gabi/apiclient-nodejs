import { BaseBarrierParams, BaseCarePlanParams, BaseRedFlagParams } from '.';
import { Field, InputType } from '@nestjs/graphql';
import { ErrorType, Errors } from '../common';
import { ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { IsObjectId } from '@argus/hepiusClient';

/**************************************************************************************************
 ********************************** Input params for gql methods **********************************
 *************************************************************************************************/

@InputType()
export class CreateRedFlagParamsWizard extends BaseRedFlagParams {
  @Field(() => [CreateBarrierParamsWizard])
  @ValidateNested({ each: true })
  @Type(() => CreateBarrierParamsWizard)
  barriers: CreateBarrierParamsWizard[];
}

@InputType()
export class CreateBarrierParamsWizard extends BaseBarrierParams {
  @Field(() => [BaseCarePlanParams])
  @ValidateNested({ each: true })
  @Type(() => BaseCarePlanParams)
  carePlans: BaseCarePlanParams[];
}

@InputType()
export class SubmitCareWizardParams {
  @Field(() => CreateRedFlagParamsWizard)
  @ValidateNested()
  @Type(() => CreateRedFlagParamsWizard)
  redFlag: CreateRedFlagParamsWizard;

  @Field(() => String)
  @IsObjectId({ message: Errors.get(ErrorType.memberIdInvalid) })
  memberId: string;
}
