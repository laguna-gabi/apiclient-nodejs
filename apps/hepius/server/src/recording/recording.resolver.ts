import { UserRole } from '@argus/hepiusClient';
import { EntityName, Environments, ServiceName, StorageType } from '@argus/pandora';
import {
  PoseidonMessagePatterns,
  Speaker,
  Transcript,
  generateTranscriptResponse,
} from '@argus/poseidonClient';
import { Inject, UseInterceptors } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { ClientProxy } from '@nestjs/microservices';
import { camelCase } from 'lodash';
import {
  CompleteMultipartUploadParams,
  MultipartUploadInfo,
  MultipartUploadRecordingLinkParams,
  Recording,
  RecordingLinkParams,
  RecordingService,
  UpdateRecordingParams,
  UpdateRecordingReviewParams,
} from '.';
import {
  Ace,
  Client,
  ErrorType,
  Errors,
  IsValidObjectId,
  LoggerService,
  LoggingInterceptor,
  Roles,
} from '../common';
import { JourneyService } from '../journey';
import { StorageService } from '../providers';

@UseInterceptors(LoggingInterceptor)
@Resolver(() => Recording)
export class RecordingResolver {
  constructor(
    @Inject(ServiceName.poseidon) private client: ClientProxy,
    readonly recordingService: RecordingService,
    private readonly storageService: StorageService,
    readonly journeyService: JourneyService,
    readonly logger: LoggerService,
  ) {}

  @Query(() => String)
  @Roles(UserRole.lagunaCoach, UserRole.lagunaNurse, UserRole.coach)
  @Ace({ entityName: EntityName.member, idLocator: `memberId` })
  async getMemberUploadRecordingLink(
    @Args(camelCase(RecordingLinkParams.name))
    recordingLinkParams: RecordingLinkParams,
  ) {
    return this.storageService.getUploadUrl({
      ...recordingLinkParams,
      storageType: StorageType.recordings,
    });
  }

  @Query(() => MultipartUploadInfo)
  @Roles(UserRole.lagunaCoach, UserRole.lagunaNurse, UserRole.coach)
  @Ace({ entityName: EntityName.member, idLocator: `memberId` })
  async getMemberMultipartUploadRecordingLink(
    @Args(camelCase(MultipartUploadRecordingLinkParams.name))
    multipartUploadRecordingLinkParams: MultipartUploadRecordingLinkParams,
  ) {
    return this.storageService.getMultipartUploadUrl({
      ...multipartUploadRecordingLinkParams,
      storageType: StorageType.recordings,
    });
  }

  @Mutation(() => Boolean)
  @Roles(UserRole.lagunaCoach, UserRole.lagunaNurse, UserRole.coach)
  @Ace({ entityName: EntityName.member, idLocator: `memberId` })
  async completeMultipartUpload(
    @Args(camelCase(CompleteMultipartUploadParams.name))
    completeMultipartUploadParams: CompleteMultipartUploadParams,
  ) {
    return this.storageService.completeMultipartUpload({
      ...completeMultipartUploadParams,
      storageType: StorageType.recordings,
    });
  }

  @Query(() => String)
  @Roles(UserRole.lagunaCoach, UserRole.lagunaNurse, UserRole.coach)
  @Ace({ entityName: EntityName.member, idLocator: `memberId` })
  async getMemberDownloadRecordingLink(
    @Args(camelCase(RecordingLinkParams.name))
    recordingLinkParams: RecordingLinkParams,
  ) {
    return this.storageService.getDownloadUrl({
      ...recordingLinkParams,
      storageType: StorageType.recordings,
    });
  }

  @Mutation(() => Recording)
  @Roles(UserRole.lagunaCoach, UserRole.lagunaNurse, UserRole.coach)
  @Ace({ entityName: EntityName.member, idLocator: `memberId` })
  async updateRecording(
    @Args(camelCase(UpdateRecordingParams.name)) updateRecordingParams: UpdateRecordingParams,
    @Client('_id') userId,
  ) {
    const { id: journeyId } = await this.journeyService.getRecent(updateRecordingParams.memberId);
    return this.recordingService.updateRecording({ ...updateRecordingParams, userId, journeyId });
  }

  @Mutation(() => Boolean, { nullable: true })
  @Roles(UserRole.lagunaCoach, UserRole.lagunaNurse, UserRole.coach)
  @Ace({
    entityName: EntityName.recording,
    idLocator: `recordingId`,
    entityMemberIdLocator: 'memberId',
  })
  async updateRecordingReview(
    @Args(camelCase(UpdateRecordingReviewParams.name))
    updateRecordingReviewParams: UpdateRecordingReviewParams,
    @Client('_id') userId,
  ) {
    return this.recordingService.updateRecordingReview({
      ...updateRecordingReviewParams,
      userId,
    });
  }

  @Query(() => [Recording])
  @Roles(UserRole.lagunaCoach, UserRole.lagunaNurse, UserRole.coach)
  @Ace({ entityName: EntityName.member, idLocator: `memberId` })
  async getRecordings(
    @Args(
      'memberId',
      { type: () => String },
      new IsValidObjectId(Errors.get(ErrorType.memberIdInvalid)),
    )
    memberId: string,
  ) {
    const { id: journeyId } = await this.journeyService.getRecent(memberId);
    return this.recordingService.getRecordings({ memberId, journeyId });
  }

  /*************************************************************************************************
   ******************************************* Transcript ******************************************
   ************************************************************************************************/

  @Query(() => Transcript, { nullable: true })
  @Roles(UserRole.lagunaCoach, UserRole.lagunaNurse, UserRole.coach)
  @Ace({
    entityName: EntityName.recording,
    idLocator: `recordingId`,
    entityMemberIdLocator: 'memberId',
  })
  async getTranscript(
    @Args('recordingId', { type: () => String })
    recordingId: string,
  ) {
    if (process.env.NODE_ENV === Environments.production) {
      return this.client.send(PoseidonMessagePatterns.getTranscript, { recordingId }).toPromise();
    } else {
      return generateTranscriptResponse();
    }
  }

  @Mutation(() => Transcript, { nullable: true })
  @Roles(UserRole.lagunaCoach, UserRole.lagunaNurse, UserRole.coach)
  @Ace({
    entityName: EntityName.recording,
    idLocator: `recordingId`,
    entityMemberIdLocator: 'memberId',
  })
  async setTranscriptSpeaker(
    @Args('recordingId', { type: () => String })
    recordingId: string,
    @Args('coach', { type: () => Speaker })
    coach: Speaker,
  ) {
    if (process.env.NODE_ENV === Environments.production) {
      return this.client
        .send(PoseidonMessagePatterns.setTranscriptSpeaker, { recordingId, coach })
        .toPromise();
    } else {
      return generateTranscriptResponse();
    }
  }
}
