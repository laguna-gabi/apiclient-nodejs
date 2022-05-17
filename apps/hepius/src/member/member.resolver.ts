import {
  AppointmentStatus,
  Caregiver,
  Identifier,
  MemberRole,
  User,
  UserRole,
} from '@argus/hepiusClient';
import {
  AlertInternalKey,
  ChatInternalKey,
  ContentKey,
  ExternalKey,
  IDeleteClientSettings,
  IDeleteDispatch,
  IUpdateSenderClientId,
  InnerQueueTypes as IrisInnerQueueTypes,
  JournalCustomKey,
  LogInternalKey,
  NotifyCustomKey,
  RegisterInternalKey,
  generateDispatchId,
} from '@argus/irisClient';
import {
  GlobalEventType,
  IEventNotifySlack,
  NotificationType,
  Platform,
  QueueType,
  ServiceName,
  SlackChannel,
  SlackIcon,
  StorageType,
  formatEx,
} from '@argus/pandora';
import { PoseidonMessagePatterns, Speaker, Transcript } from '@argus/poseidonClient';
import { Inject, UseInterceptors } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { ClientProxy } from '@nestjs/microservices';
import { isEmpty } from 'class-validator';
import { hosts } from 'config';
import { addDays, isAfter, millisecondsInHour } from 'date-fns';
import { getTimezoneOffset } from 'date-fns-tz';
import { camelCase } from 'lodash';
import { lookup } from 'zipcode-to-timezone';
import {
  Client,
  ErrorType,
  Errors,
  EventType,
  IEventDeleteMember,
  IEventMember,
  IEventNotifyQueue,
  IEventOnAlertForQRSubmit,
  IEventOnReceivedChatMessage,
  IEventOnReceivedTextMessage,
  IEventOnReplacedUserForMember,
  IEventOnUpdatedMemberPlatform,
  IInternalDispatch,
  IsValidObjectId,
  LoggerService,
  LoggingInterceptor,
  MemberIdParam,
  MemberIdParamType,
  MemberUserRouteInterceptor,
  RegisterForNotificationParams,
  Roles,
  generatePath,
  getCorrelationId,
} from '../common';
import { Communication, CommunicationService, GetCommunicationParams } from '../communication';
import {
  Bitly,
  CognitoService,
  FeatureFlagService,
  OneSignal,
  StorageService,
  TwilioService,
} from '../providers';
import { QuestionnaireAlerts, QuestionnaireType } from '../questionnaire';
import { UserService } from '../user';
import {
  AddCaregiverParams,
  Alert,
  AppointmentCompose,
  AudioType,
  CancelNotifyParams,
  ChatMessageOrigin,
  CompleteMultipartUploadParams,
  CreateMemberParams,
  CreateTaskParams,
  DeleteDischargeDocumentParams,
  DeleteMemberGeneralDocumentParams,
  DeleteMemberParams,
  DischargeDocumentsLinks,
  GetMemberUploadGeneralDocumentLinkParams,
  GetMemberUploadJournalAudioLinkParams,
  GetMemberUploadJournalImageLinkParams,
  ImageType,
  Journal,
  JournalUploadAudioLink,
  JournalUploadImageLink,
  JourneyService,
  Member,
  MemberBase,
  MemberConfig,
  MemberService,
  MemberSummary,
  MultipartUploadInfo,
  MultipartUploadRecordingLinkParams,
  NotifyContentMetadata,
  NotifyContentParams,
  NotifyParams,
  Recording,
  RecordingLinkParams,
  RecordingOutput,
  ReplaceMemberOrgParams,
  ReplaceUserForMemberParams,
  SetGeneralNotesParams,
  TaskStatus,
  UpdateCaregiverParams,
  UpdateJournalTextParams,
  UpdateMemberConfigParams,
  UpdateMemberParams,
  UpdateRecordingParams,
  UpdateRecordingReviewParams,
  UpdateTaskStatusParams,
} from './index';

@UseInterceptors(LoggingInterceptor)
@Resolver(() => Member)
export class MemberResolver extends MemberBase {
  constructor(
    @Inject(ServiceName.poseidon) private client: ClientProxy,
    readonly memberService: MemberService,
    readonly eventEmitter: EventEmitter2,
    private readonly storageService: StorageService,
    private readonly cognitoService: CognitoService,
    private readonly oneSignal: OneSignal,
    readonly userService: UserService,
    readonly communicationService: CommunicationService,
    protected readonly bitly: Bitly,
    readonly featureFlagService: FeatureFlagService,
    readonly journeyService: JourneyService,
    readonly twilio: TwilioService,
    readonly logger: LoggerService,
  ) {
    super(
      memberService,
      eventEmitter,
      userService,
      featureFlagService,
      journeyService,
      twilio,
      logger,
    );
  }

  @Mutation(() => Identifier)
  @Roles(UserRole.coach, UserRole.nurse)
  async createMember(
    @Args(camelCase(CreateMemberParams.name))
    createMemberParams: CreateMemberParams,
  ): Promise<Member> {
    return super.createMember(createMemberParams);
  }

  @Query(() => Member, { nullable: true })
  @MemberIdParam(MemberIdParamType.id)
  @UseInterceptors(MemberUserRouteInterceptor)
  @Roles(MemberRole.member, UserRole.coach, UserRole.nurse)
  async getMember(
    @Args(
      'id',
      { type: () => String, nullable: true },
      new IsValidObjectId(Errors.get(ErrorType.memberIdInvalid), { nullable: true }),
    )
    id?: string,
  ): Promise<Member> {
    const member = await this.memberService.get(id);
    member.zipCode = member.zipCode || member.org.zipCode;
    member.utcDelta = MemberResolver.getTimezoneDeltaFromZipcode(member.zipCode);
    return member;
  }

  @Mutation(() => Member)
  @Roles(UserRole.coach, UserRole.nurse)
  async updateMember(
    @Args(camelCase(UpdateMemberParams.name)) params: UpdateMemberParams,
  ): Promise<Member> {
    const objMobile = params.phoneSecondary
      ? { phoneSecondaryType: await this.twilio.getPhoneType(params.phoneSecondary) }
      : {};
    const member = await this.memberService.update({ ...params, ...objMobile });
    member.zipCode = member.zipCode || member.org.zipCode;
    member.utcDelta = MemberResolver.getTimezoneDeltaFromZipcode(member.zipCode);
    this.notifyUpdatedMemberConfig({ member });
    return member;
  }

  @Query(() => [MemberSummary])
  @Roles(UserRole.coach, UserRole.nurse)
  async getMembers(
    @Args(
      'orgId',
      { type: () => String, nullable: true },
      new IsValidObjectId(Errors.get(ErrorType.memberOrgIdInvalid), { nullable: true }),
    )
    orgId?: string,
  ): Promise<MemberSummary[]> {
    return this.memberService.getByOrg(orgId);
  }

  @Query(() => [AppointmentCompose])
  @Roles(UserRole.coach, UserRole.nurse)
  async getMembersAppointments(
    @Args(
      'orgId',
      { type: () => String, nullable: true },
      new IsValidObjectId(Errors.get(ErrorType.memberOrgIdInvalid), { nullable: true }),
    )
    orgId?: string,
  ): Promise<AppointmentCompose[]> {
    return this.memberService.getMembersAppointments(orgId);
  }

  /*************************************************************************************************
   ************************************ internal admin mutations ***********************************
   ************************************************************************************************/

  @Mutation(() => Boolean)
  @Roles(UserRole.admin)
  async deleteMember(
    @Client('_id') userId,
    @Args(camelCase(DeleteMemberParams.name))
    deleteMemberParams: DeleteMemberParams,
  ) {
    const { id, hard } = deleteMemberParams;
    const { member, memberConfig } = await this.memberService.deleteMember(
      deleteMemberParams,
      userId,
    );
    const eventParams: IEventDeleteMember = {
      memberId: id,
      deletedBy: userId,
      hard,
    };
    await this.deleteSchedules(eventParams);
    this.notifyDeletedMemberConfig(id, hard);
    this.eventEmitter.emit(EventType.onDeletedMember, eventParams);
    await this.deleteMemberFromServices(member, memberConfig, hard);
    return true;
  }

  private async deleteMemberFromServices(
    member: Member,
    memberConfig: MemberConfig,
    hard: boolean,
  ) {
    await this.oneSignal.unregister(memberConfig);
    if (member.deviceId) {
      await this.cognitoService.deleteClient(member.deviceId);
    }
    if (hard) {
      await this.storageService.deleteMember(member.id);
    }
  }

  @Mutation(() => Boolean, { nullable: true })
  @Roles(UserRole.admin)
  async replaceUserForMember(
    @Args(camelCase(ReplaceUserForMemberParams.name))
    replaceUserForMemberParams: ReplaceUserForMemberParams,
  ) {
    const newUser = await this.userService.get(replaceUserForMemberParams.userId);
    if (!newUser) {
      throw new Error(Errors.get(ErrorType.userNotFound));
    }

    const member = await this.memberService.updatePrimaryUser(replaceUserForMemberParams);
    const { platform } = await this.memberService.getMemberConfig(member.id);
    const updateUserInCommunicationParams: IEventOnReplacedUserForMember = {
      newUser,
      oldUserId: member.primaryUserId.toString(),
      member,
      platform,
    };
    this.eventEmitter.emit(EventType.onReplacedUserForMember, updateUserInCommunicationParams);

    const updateSenderClientId: IUpdateSenderClientId = {
      type: IrisInnerQueueTypes.updateSenderClientId,
      recipientClientId: member.id,
      senderClientId: newUser.id,
      correlationId: getCorrelationId(this.logger),
    };
    const eventParams: IEventNotifyQueue = {
      type: QueueType.notifications,
      message: JSON.stringify(updateSenderClientId),
    };
    this.eventEmitter.emit(GlobalEventType.notifyQueue, eventParams);

    return true;
  }

  @Mutation(() => Boolean, { nullable: true })
  @Roles(UserRole.admin)
  async replaceMemberOrg(
    @Args(camelCase(ReplaceMemberOrgParams.name))
    replaceMemberOrgParams: ReplaceMemberOrgParams,
  ) {
    const member = await this.memberService.replaceMemberOrg(replaceMemberOrgParams);
    this.notifyUpdatedMemberConfig({ member });
    return true;
  }

  /*************************************************************************************************
   ************************************ DischargeDocumentsLinks ************************************
   ************************************************************************************************/

  @Query(() => DischargeDocumentsLinks)
  @MemberIdParam(MemberIdParamType.id)
  @UseInterceptors(MemberUserRouteInterceptor)
  @Roles(MemberRole.member, UserRole.coach, UserRole.nurse)
  async getMemberUploadDischargeDocumentsLinks(
    @Args('id', { type: () => String }, new IsValidObjectId(Errors.get(ErrorType.memberIdInvalid)))
    id?: string,
  ) {
    const member = await this.memberService.get(id);

    const { firstName, lastName } = member;

    const storageType = StorageType.documents;
    const [dischargeNotesLink, dischargeInstructionsLink] = await Promise.all([
      await this.storageService.getUploadUrl({
        storageType,
        memberId: id,
        id: `${firstName}_${lastName}_Summary.pdf`,
      }),
      await this.storageService.getUploadUrl({
        storageType,
        memberId: id,
        id: `${firstName}_${lastName}_Instructions.pdf`,
      }),
    ]);

    return { dischargeNotesLink, dischargeInstructionsLink };
  }

  @Query(() => DischargeDocumentsLinks)
  @MemberIdParam(MemberIdParamType.id)
  @UseInterceptors(MemberUserRouteInterceptor)
  @Roles(MemberRole.member, UserRole.coach, UserRole.nurse)
  async getMemberDownloadDischargeDocumentsLinks(
    @Args(
      'id',
      { type: () => String, nullable: true },
      new IsValidObjectId(Errors.get(ErrorType.memberIdInvalid), { nullable: true }),
    )
    id?: string,
  ) {
    const member = await this.memberService.get(id);
    const { firstName, lastName } = member;

    const storageType = StorageType.documents;
    const [dischargeNotesLink, dischargeInstructionsLink] = await Promise.all([
      await this.storageService.getDownloadUrl({
        storageType,
        memberId: id,
        id: `${firstName}_${lastName}_Summary.pdf`,
      }),
      await this.storageService.getDownloadUrl({
        storageType,
        memberId: id,
        id: `${firstName}_${lastName}_Instructions.pdf`,
      }),
    ]);

    return { dischargeNotesLink, dischargeInstructionsLink };
  }

  @Mutation(() => Boolean)
  @Roles(UserRole.coach, UserRole.nurse)
  async deleteDischargeDocument(
    @Args(camelCase(DeleteDischargeDocumentParams.name))
    deleteDischargeDocumentParams: DeleteDischargeDocumentParams,
  ) {
    const { memberId, dischargeDocumentType } = deleteDischargeDocumentParams;
    const { firstName, lastName } = await this.memberService.get(memberId);

    await this.storageService.moveToDeleted({
      storageType: StorageType.documents,
      memberId,
      id: `${firstName}_${lastName}_${dischargeDocumentType}.pdf`,
    });

    return true;
  }

  /*************************************************************************************************
   ************************************ GeneralDocumentsLinks ************************************
   ************************************************************************************************/

  @Query(() => String)
  @Roles(UserRole.coach, UserRole.nurse)
  async getMemberUploadGeneralDocumentLink(
    @Args(camelCase(GetMemberUploadGeneralDocumentLinkParams.name))
    getMemberUploadGeneralDocumentLinkParams: GetMemberUploadGeneralDocumentLinkParams,
  ) {
    const { memberId, fileName } = getMemberUploadGeneralDocumentLinkParams;

    // Validating member exists
    await this.memberService.get(memberId);

    if (
      await this.storageService.doesDocumentAlreadyExists({
        storageType: StorageType.general,
        memberId,
        id: fileName,
      })
    ) {
      throw new Error(Errors.get(ErrorType.memberUploadAlreadyExistingGeneralDocument));
    }

    return this.storageService.getUploadUrl({
      storageType: StorageType.general,
      memberId,
      id: fileName,
    });
  }

  @Query(() => [String])
  @Roles(UserRole.coach, UserRole.nurse)
  async getMemberDownloadGeneralDocumentsLinks(
    @Args(
      'memberId',
      { type: () => String },
      new IsValidObjectId(Errors.get(ErrorType.memberIdInvalid)),
    )
    memberId: string,
  ) {
    // Validating member exists
    await this.memberService.get(memberId);

    const files = await this.storageService.getFolderFiles({
      storageType: StorageType.general,
      memberId,
    });

    return Promise.all(
      files.map(async (file) => {
        return this.storageService.getDownloadUrl({
          storageType: StorageType.general,
          memberId,
          id: file,
        });
      }),
    );
  }

  @Mutation(() => Boolean)
  @Roles(UserRole.coach, UserRole.nurse)
  async deleteMemberGeneralDocument(
    @Args(camelCase(DeleteMemberGeneralDocumentParams.name))
    deleteMemberGeneralDocumentParams: DeleteMemberGeneralDocumentParams,
  ) {
    const { memberId, fileName } = deleteMemberGeneralDocumentParams;

    // Validating member exists
    await this.memberService.get(memberId);

    return this.storageService.deleteFile({
      storageType: StorageType.general,
      memberId,
      id: fileName,
    });
  }

  /*************************************************************************************************
   ******************************************* Recording *******************************************
   ************************************************************************************************/

  @Query(() => String)
  @Roles(UserRole.coach, UserRole.nurse)
  async getMemberUploadRecordingLink(
    @Args(camelCase(RecordingLinkParams.name))
    recordingLinkParams: RecordingLinkParams,
  ) {
    // Validating member exists
    await this.memberService.get(recordingLinkParams.memberId);
    return this.storageService.getUploadUrl({
      ...recordingLinkParams,
      storageType: StorageType.recordings,
    });
  }

  @Query(() => MultipartUploadInfo)
  @Roles(UserRole.coach, UserRole.nurse)
  async getMemberMultipartUploadRecordingLink(
    @Args(camelCase(MultipartUploadRecordingLinkParams.name))
    multipartUploadRecordingLinkParams: MultipartUploadRecordingLinkParams,
  ) {
    // Validating member exists
    await this.memberService.get(multipartUploadRecordingLinkParams.memberId);
    return this.storageService.getMultipartUploadUrl({
      ...multipartUploadRecordingLinkParams,
      storageType: StorageType.recordings,
    });
  }

  @Mutation(() => Boolean)
  @Roles(UserRole.coach, UserRole.nurse)
  async completeMultipartUpload(
    @Args(camelCase(CompleteMultipartUploadParams.name))
    completeMultipartUploadParams: CompleteMultipartUploadParams,
  ) {
    // Validating member exists
    await this.memberService.get(completeMultipartUploadParams.memberId);
    return this.storageService.completeMultipartUpload({
      ...completeMultipartUploadParams,
      storageType: StorageType.recordings,
    });
  }

  @Query(() => String)
  @Roles(UserRole.coach, UserRole.nurse)
  async getMemberDownloadRecordingLink(
    @Args(camelCase(RecordingLinkParams.name))
    recordingLinkParams: RecordingLinkParams,
  ) {
    // Validating member exists
    await this.memberService.get(recordingLinkParams.memberId);
    return this.storageService.getDownloadUrl({
      ...recordingLinkParams,
      storageType: StorageType.recordings,
    });
  }

  @Mutation(() => Recording)
  @Roles(UserRole.coach, UserRole.nurse)
  async updateRecording(
    @Args(camelCase(UpdateRecordingParams.name)) updateRecordingParams: UpdateRecordingParams,
    @Client('_id') userId,
  ) {
    return this.memberService.updateRecording(updateRecordingParams, userId);
  }

  @Mutation(() => Boolean, { nullable: true })
  @Roles(UserRole.coach, UserRole.nurse)
  async updateRecordingReview(
    @Args(camelCase(UpdateRecordingReviewParams.name))
    updateRecordingReviewParams: UpdateRecordingReviewParams,
    @Client('_id') userId,
  ) {
    return this.memberService.updateRecordingReview(updateRecordingReviewParams, userId);
  }

  @Query(() => [RecordingOutput])
  @Roles(UserRole.coach, UserRole.nurse)
  async getRecordings(
    @Args(
      'memberId',
      { type: () => String },
      new IsValidObjectId(Errors.get(ErrorType.memberIdInvalid)),
    )
    memberId: string,
  ) {
    return this.memberService.getRecordings(memberId);
  }

  /*************************************************************************************************
   ******************************************* Transcript ******************************************
   ************************************************************************************************/

  @Query(() => Transcript, { nullable: true })
  @Roles(UserRole.coach, UserRole.nurse)
  async getTranscript(
    @Args('recordingId', { type: () => String })
    recordingId: string,
  ) {
    return this.client.send(PoseidonMessagePatterns.getTranscript, recordingId).toPromise();
  }

  @Mutation(() => Transcript, { nullable: true })
  @Roles(UserRole.coach, UserRole.nurse)
  async setTranscriptSpeaker(
    @Args('recordingId', { type: () => String })
    recordingId: string,
    @Args('coach', { type: () => Speaker })
    coach: Speaker,
  ) {
    return this.client
      .send(PoseidonMessagePatterns.setTranscriptSpeaker, { recordingId, coach })
      .toPromise();
  }

  /*************************************************************************************************
   ****************************************** Action items *****************************************
   ************************************************************************************************/

  @Mutation(() => Identifier)
  @Roles(UserRole.coach, UserRole.nurse)
  async createActionItem(
    @Args(camelCase(CreateTaskParams.name))
    createTaskParams: CreateTaskParams,
  ) {
    return this.memberService.insertActionItem({
      createTaskParams,
      status: TaskStatus.pending,
    });
  }

  @Mutation(() => Boolean, { nullable: true })
  @Roles(UserRole.coach, UserRole.nurse)
  async updateActionItemStatus(
    @Args(camelCase(UpdateTaskStatusParams.name))
    updateTaskStatusParams: UpdateTaskStatusParams,
  ) {
    return this.memberService.updateActionItemStatus(updateTaskStatusParams);
  }

  /*************************************************************************************************
   ****************************************** General notes ****************************************
   ************************************************************************************************/

  @Mutation(() => Boolean, { nullable: true })
  @Roles(UserRole.coach, UserRole.nurse)
  async setGeneralNotes(
    @Args(camelCase(SetGeneralNotesParams.name)) setGeneralNotesParams: SetGeneralNotesParams,
  ) {
    return this.memberService.setGeneralNotes(setGeneralNotesParams);
  }

  /*************************************************************************************************
   ******************************************** Journal ********************************************
   ************************************************************************************************/

  @Mutation(() => Identifier)
  @Roles(MemberRole.member)
  async createJournal(@Client('roles') roles, @Client('_id') memberId) {
    if (!roles.includes(MemberRole.member)) {
      throw new Error(Errors.get(ErrorType.memberAllowedOnly));
    }
    return this.memberService.createJournal(memberId);
  }

  @Mutation(() => Journal)
  @Roles(MemberRole.member)
  async updateJournalText(
    @Client('roles') roles,
    @Client('_id') memberId,
    @Args(camelCase(UpdateJournalTextParams.name)) updateJournalTextParams: UpdateJournalTextParams,
  ) {
    if (!roles.includes(MemberRole.member)) {
      throw new Error(Errors.get(ErrorType.memberAllowedOnly));
    }
    const journal = await this.memberService.updateJournal({
      ...updateJournalTextParams,
      memberId,
      published: false,
    });

    return this.addMemberDownloadJournalLinks(journal);
  }

  @Query(() => Journal)
  @Roles(MemberRole.member)
  async getJournal(
    @Client('roles') roles,
    @Client('_id') memberId,
    @Args('id', { type: () => String }) id: string,
  ) {
    if (!roles.includes(MemberRole.member)) {
      throw new Error(Errors.get(ErrorType.memberAllowedOnly));
    }
    const journal = await this.memberService.getJournal(id, memberId);

    return this.addMemberDownloadJournalLinks(journal);
  }

  @Query(() => [Journal])
  @Roles(MemberRole.member)
  async getJournals(@Client('roles') roles, @Client('_id') memberId) {
    if (!roles.includes(MemberRole.member)) {
      throw new Error(Errors.get(ErrorType.memberAllowedOnly));
    }
    const journals = await this.memberService.getJournals(memberId);

    return Promise.all(
      journals.map(async (journal) => {
        return this.addMemberDownloadJournalLinks(journal);
      }),
    );
  }

  @Mutation(() => Boolean)
  @Roles(MemberRole.member)
  async deleteJournal(
    @Client('roles') roles,
    @Client('_id') memberId,
    @Args(
      'id',
      { type: () => String },
      new IsValidObjectId(Errors.get(ErrorType.memberJournalIdInvalid)),
    )
    id: string,
  ) {
    if (!roles.includes(MemberRole.member)) {
      throw new Error(Errors.get(ErrorType.memberAllowedOnly));
    }
    const { imageFormat, audioFormat } = await this.memberService.deleteJournal(id, memberId);

    if (imageFormat) {
      await Promise.all([
        this.storageService.deleteFile({
          id: `${id}${ImageType.SmallImage}.${imageFormat}`,
          memberId,
          storageType: StorageType.journals,
        }),
        this.storageService.deleteFile({
          id: `${id}${ImageType.NormalImage}.${imageFormat}`,
          memberId,
          storageType: StorageType.journals,
        }),
      ]);
    }

    if (audioFormat) {
      await this.storageService.deleteFile({
        memberId,
        storageType: StorageType.journals,
        id: `${id}${AudioType}.${audioFormat}`,
      });
    }

    return true;
  }

  @Query(() => JournalUploadImageLink)
  @Roles(MemberRole.member)
  async getMemberUploadJournalImageLink(
    @Client('roles') roles,
    @Client('_id') memberId,
    @Args(camelCase(GetMemberUploadJournalImageLinkParams.name))
    getMemberUploadJournalImageLinkParams: GetMemberUploadJournalImageLinkParams,
  ) {
    if (!roles.includes(MemberRole.member)) {
      throw new Error(Errors.get(ErrorType.memberAllowedOnly));
    }
    const { id, imageFormat } = getMemberUploadJournalImageLinkParams;

    await this.memberService.updateJournal({ id, memberId, imageFormat, published: false });
    const normalImageLink = await this.storageService.getUploadUrl({
      storageType: StorageType.journals,
      memberId,
      id: `${id}${ImageType.NormalImage}.${imageFormat}`,
    });

    return { normalImageLink };
  }

  @Query(() => JournalUploadAudioLink)
  @Roles(MemberRole.member)
  async getMemberUploadJournalAudioLink(
    @Client('roles') roles,
    @Client('_id') memberId,
    @Args(camelCase(GetMemberUploadJournalAudioLinkParams.name))
    getMemberUploadJournalAudioLinkParams: GetMemberUploadJournalAudioLinkParams,
  ) {
    if (!roles.includes(MemberRole.member)) {
      throw new Error(Errors.get(ErrorType.memberAllowedOnly));
    }
    const { id, audioFormat } = getMemberUploadJournalAudioLinkParams;

    await this.memberService.updateJournal({ id, memberId, audioFormat, published: false });
    const audioLink = await this.storageService.getUploadUrl({
      storageType: StorageType.journals,
      memberId,
      id: `${id}${AudioType}.${audioFormat}`,
    });

    return { audioLink };
  }

  @Mutation(() => Boolean)
  @Roles(MemberRole.member)
  async deleteJournalImage(
    @Client('roles') roles,
    @Client('_id') memberId,
    @Args(
      'id',
      { type: () => String },
      new IsValidObjectId(Errors.get(ErrorType.memberJournalIdInvalid)),
    )
    id: string,
  ) {
    if (!roles.includes(MemberRole.member)) {
      throw new Error(Errors.get(ErrorType.memberAllowedOnly));
    }
    const { imageFormat } = await this.memberService.getJournal(id, memberId);

    if (!imageFormat) {
      throw new Error(Errors.get(ErrorType.memberJournalImageNotFound));
    }

    await this.memberService.updateJournal({ id, memberId, imageFormat: null, published: false });
    await Promise.all([
      this.storageService.deleteFile({
        id: `${id}${ImageType.SmallImage}.${imageFormat}`,
        memberId,
        storageType: StorageType.journals,
      }),
      this.storageService.deleteFile({
        id: `${id}${ImageType.NormalImage}.${imageFormat}`,
        memberId,
        storageType: StorageType.journals,
      }),
    ]);

    return true;
  }

  @Mutation(() => Boolean)
  @Roles(MemberRole.member)
  async deleteJournalAudio(
    @Client('roles') roles,
    @Client('_id') memberId,
    @Args(
      'id',
      { type: () => String },
      new IsValidObjectId(Errors.get(ErrorType.memberJournalIdInvalid)),
    )
    id: string,
  ) {
    if (!roles.includes(MemberRole.member)) {
      throw new Error(Errors.get(ErrorType.memberAllowedOnly));
    }
    const { audioFormat } = await this.memberService.getJournal(id, memberId);

    if (!audioFormat) {
      throw new Error(Errors.get(ErrorType.memberJournalAudioNotFound));
    }

    await this.memberService.updateJournal({ id, memberId, audioFormat: null, published: false });
    return this.storageService.deleteFile({
      memberId,
      storageType: StorageType.journals,
      id: `${id}${AudioType}.${audioFormat}`,
    });
  }

  @Mutation(() => Boolean, { nullable: true })
  @Roles(MemberRole.member)
  async publishJournal(
    @Client('roles') roles,
    @Client('_id') memberId,
    @Args('id', { type: () => String }) id: string,
  ) {
    if (!roles.includes(MemberRole.member)) {
      throw new Error(Errors.get(ErrorType.memberAllowedOnly));
    }
    const { imageFormat, audioFormat, text } = await this.memberService.updateJournal({
      id,
      memberId,
      published: true,
    });
    const member = await this.memberService.get(memberId);
    const sendBirdChannelUrl = await this.getSendBirdChannelUrl({
      memberId,
      userId: member.primaryUserId.toString(),
    });

    let journalImageDownloadLink;
    let journalAudioDownloadLink;
    if (imageFormat) {
      journalImageDownloadLink = await this.storageService.getDownloadUrl({
        storageType: StorageType.journals,
        memberId,
        id: `${id}${ImageType.NormalImage}.${imageFormat}`,
      });
    }
    if (audioFormat) {
      journalAudioDownloadLink = await this.storageService.getDownloadUrl({
        storageType: StorageType.journals,
        memberId,
        id: `${id}${AudioType}.${audioFormat}`,
      });
    }

    const dispatch: IInternalDispatch = {
      correlationId: getCorrelationId(this.logger),
      dispatchId: generateDispatchId(
        JournalCustomKey.journalContent,
        memberId,
        Date.now().toString(),
      ),
      recipientClientId: member.primaryUserId.toString(),
      senderClientId: member.id,
      notificationType: NotificationType.chat,
      contentKey: JournalCustomKey.journalContent,
      sendBirdChannelUrl,
      content: text,
      journalImageDownloadLink,
      journalAudioDownloadLink,
    };
    await this.notifyCreateDispatch(dispatch);
  }

  private async addMemberDownloadJournalLinks(journal: Journal) {
    const { id, memberId, imageFormat, audioFormat } = journal;
    let normalImageLink: string;
    let smallImageLink: string;
    let audioLink: string;

    if (imageFormat) {
      [normalImageLink, smallImageLink] = await Promise.all([
        this.storageService.getDownloadUrl({
          storageType: StorageType.journals,
          memberId: memberId.toString(),
          id: `${id}${ImageType.NormalImage}.${imageFormat}`,
        }),
        this.storageService.getDownloadUrl({
          storageType: StorageType.journals,
          memberId: memberId.toString(),
          id: `${id}${ImageType.SmallImage}.${imageFormat}`,
        }),
      ]);
    }
    if (audioFormat) {
      audioLink = await this.storageService.getDownloadUrl({
        storageType: StorageType.journals,
        memberId: memberId.toString(),
        id: `${id}${AudioType}.${audioFormat}`,
      });
    }
    journal.journalDownloadLinks = { normalImageLink, smallImageLink, audioLink };

    return journal;
  }

  /*************************************************************************************************
   ******************************************* Caregivers ******************************************
   ************************************************************************************************/

  @Mutation(() => Caregiver)
  @Roles(MemberRole.member, UserRole.coach, UserRole.nurse)
  @MemberIdParam(MemberIdParamType.memberId)
  @UseInterceptors(MemberUserRouteInterceptor)
  async addCaregiver(
    @Args(camelCase(AddCaregiverParams.name), { type: () => AddCaregiverParams })
    addCaregiverParams: AddCaregiverParams,
  ): Promise<Caregiver> {
    return this.memberService.addCaregiver(addCaregiverParams);
  }

  @Mutation(() => Boolean)
  @Roles(MemberRole.member, UserRole.coach, UserRole.nurse)
  async deleteCaregiver(
    @Args(
      'id',
      { type: () => String },
      new IsValidObjectId(Errors.get(ErrorType.caregiverIdInvalid)),
    )
    id: string,
    @Client('_id') deletedBy: string,
  ): Promise<boolean | never> {
    const caregiver = await this.memberService.getCaregiver(id);

    if (caregiver) {
      await this.memberService.deleteCaregiver(id, deletedBy);
    }

    return true;
  }

  @Mutation(() => Caregiver)
  @Roles(MemberRole.member, UserRole.coach, UserRole.nurse)
  @MemberIdParam(MemberIdParamType.memberId)
  @UseInterceptors(MemberUserRouteInterceptor)
  async updateCaregiver(
    @Args(camelCase(UpdateCaregiverParams.name), { type: () => UpdateCaregiverParams })
    updateCaregiverParams: UpdateCaregiverParams,
  ): Promise<Caregiver> {
    return this.memberService.updateCaregiver(updateCaregiverParams);
  }

  @Query(() => [Caregiver])
  @MemberIdParam(MemberIdParamType.memberId)
  @UseInterceptors(MemberUserRouteInterceptor)
  @Roles(MemberRole.member, UserRole.coach, UserRole.nurse)
  async getCaregivers(
    @Args(
      'memberId',
      { type: () => String, nullable: true },
      new IsValidObjectId(Errors.get(ErrorType.memberIdInvalid), { nullable: true }),
    )
    memberId?: string,
  ): Promise<Caregiver[]> {
    return this.memberService.getCaregiversByMemberId(memberId);
  }

  /*************************************************************************************************
   ********************************************* Alerts ********************************************
   ************************************************************************************************/
  @Mutation(() => Boolean)
  @Roles(UserRole.coach, UserRole.nurse)
  async dismissAlert(
    @Client('_id') userId: string,
    @Args('alertId', { type: () => String })
    alertId: string,
  ): Promise<boolean> {
    await this.memberService.dismissAlert(userId, alertId);
    return true;
  }

  @Query(() => [Alert])
  @Roles(UserRole.coach, UserRole.nurse)
  async getAlerts(
    @Client('_id') userId: string,
    @Client('lastQueryAlert') lastQueryAlert: Date,
  ): Promise<Alert[]> {
    return this.memberService.getAlerts(userId, lastQueryAlert);
  }

  /************************************************************************************************
   ***************************************** Notifications ****************************************
   ************************************************************************************************/

  @Mutation(() => Boolean, { nullable: true })
  @Roles(MemberRole.member)
  async registerMemberForNotifications(
    @Client('roles') roles,
    @Client('_id') memberId,
    @Args(camelCase(RegisterForNotificationParams.name))
    registerForNotificationParams: RegisterForNotificationParams,
  ) {
    if (!roles.includes(MemberRole.member)) {
      throw new Error(Errors.get(ErrorType.memberAllowedOnly));
    }
    // ignoring the id from the params - replacing it with the id from the context
    const member = await this.memberService.get(memberId);
    const currentMemberConfig = await this.memberService.getMemberConfig(memberId);
    const currentJourney = await this.journeyService.getActive(memberId);

    if (registerForNotificationParams.platform === Platform.ios) {
      const { token } = registerForNotificationParams;
      await this.oneSignal.register({ token, externalUserId: currentMemberConfig.externalUserId });
    }

    const memberConfig = await this.memberService.updateMemberConfig({
      memberId: currentMemberConfig.memberId.toString(),
      platform: registerForNotificationParams.platform,
      isPushNotificationsEnabled: registerForNotificationParams.isPushNotificationsEnabled,
    });

    const eventParams: IEventOnUpdatedMemberPlatform = {
      memberId: member.id,
      platform: registerForNotificationParams.platform,
      userId: member.primaryUserId.toString(),
    };
    this.eventEmitter.emit(EventType.onUpdatedMemberPlatform, eventParams);

    const journey = await this.journeyService.updateLoggedInAt(currentMemberConfig.memberId);
    this.notifyUpdatedMemberConfig({ memberConfig, firstLoggedInAt: journey.firstLoggedInAt });

    if (!currentJourney.firstLoggedInAt) {
      const correlationId = getCorrelationId(this.logger);
      await this.notifyCreateDispatch(
        this.generateMobileRegistrationDispatch(
          member,
          journey.firstLoggedInAt,
          correlationId,
          RegisterInternalKey.newRegisteredMember,
          1,
        ),
      );
      await this.notifyCreateDispatch(
        this.generateMobileRegistrationDispatch(
          member,
          journey.firstLoggedInAt,
          correlationId,
          RegisterInternalKey.newRegisteredMemberNudge,
          2,
        ),
      );
      await this.notifyCreateDispatch(
        this.generateMobileRegistrationDispatch(
          member,
          journey.firstLoggedInAt,
          correlationId,
          LogInternalKey.logReminder,
          3,
        ),
      );
    }

    await this.notifyDeleteDispatch({
      dispatchId: generateDispatchId(RegisterInternalKey.newMemberNudge, member.id),
    });
  }

  @Mutation(() => Boolean, { nullable: true })
  @Roles(UserRole.coach, UserRole.nurse)
  async notify(@Args(camelCase(NotifyParams.name)) notifyParams: NotifyParams) {
    const { memberId, userId, type, metadata } = notifyParams;
    const { member, memberConfig } = await this.extractDataOfMemberAndUser(memberId, userId);

    if (metadata.when && isAfter(new Date(), metadata.when)) {
      throw new Error(Errors.get(ErrorType.notificationMetadataWhenPast));
    }

    if (
      memberConfig.platform === Platform.web &&
      (type === NotificationType.call || type === NotificationType.video)
    ) {
      throw new Error(Errors.get(ErrorType.notificationMemberPlatformWeb));
    }

    if (
      !memberConfig.isPushNotificationsEnabled &&
      (type === NotificationType.call || type === NotificationType.video)
    ) {
      throw new Error(Errors.get(ErrorType.notificationNotAllowed));
    }

    if (metadata.content && isEmpty(metadata.content?.trim())) {
      throw new Error(Errors.get(ErrorType.notificationInvalidContent));
    }

    const contentKey =
      type === NotificationType.video || type === NotificationType.call
        ? NotifyCustomKey.callOrVideo
        : NotifyCustomKey.customContent;

    const sendBirdChannelUrl = await this.getSendBirdChannelUrl({
      memberId: member.id,
      userId: member.primaryUserId.toString(),
    });

    const dispatch: IInternalDispatch = {
      correlationId: getCorrelationId(this.logger),
      dispatchId: generateDispatchId(contentKey, member.id, Date.now().toString()),
      notificationType: type,
      recipientClientId: member.id,
      senderClientId: member.primaryUserId.toString(),
      contentKey,
      content: metadata.content,
      path: generatePath(type, contentKey),
      peerId: metadata.peerId,
      appointmentId: metadata.appointmentId,
      triggersAt: metadata.when,
      sendBirdChannelUrl,
    };
    await this.notifyCreateDispatch(dispatch);
  }

  @Mutation(() => String, { nullable: true })
  @Roles(UserRole.coach, UserRole.nurse)
  async notifyContent(
    @Args(camelCase(NotifyContentParams.name))
    notifyContentParams: NotifyContentParams,
  ) {
    const { memberId, userId, contentKey, metadata } = notifyContentParams;
    const { member, memberConfig } = await this.extractDataOfMemberAndUser(memberId, userId);

    const { notificationType, baseParams } = this.extractNotificationTypeAndBaseParams({
      member,
      memberConfig,
      userId,
      contentKey,
      metadata,
    });

    const dispatch: IInternalDispatch = {
      correlationId: getCorrelationId(this.logger),
      dispatchId: generateDispatchId(contentKey, member.id, Date.now().toString()),
      recipientClientId: member.id,
      senderClientId: member.primaryUserId.toString(),
      notificationType,
      contentKey,
      ...baseParams,
    };
    await this.notifyCreateDispatch(dispatch);
  }

  @Mutation(() => String, { nullable: true })
  @Roles(UserRole.coach, UserRole.nurse)
  async cancelNotify(
    @Args(camelCase(CancelNotifyParams.name))
    cancelNotifyParams: CancelNotifyParams,
  ) {
    const { memberId, type, metadata } = cancelNotifyParams;

    const contentKey = NotifyCustomKey.cancelNotify;
    const dispatch: IInternalDispatch = {
      correlationId: getCorrelationId(this.logger),
      dispatchId: generateDispatchId(contentKey, memberId, Date.now().toString()),
      recipientClientId: memberId,
      notificationType: type,
      contentKey,
      peerId: metadata.peerId,
    };
    await this.notifyCreateDispatch(dispatch);
  }

  /**
   * Listening to chat message from sendbird webhook.
   * A message can be from a user or a member.
   * Determine origin (member or user) and decide if a notification should be sent
   */
  @OnEvent(EventType.onReceivedChatMessage, { async: true })
  async notifyChatMessage(params: IEventOnReceivedChatMessage) {
    this.logger.info(params, MemberResolver.name, this.notifyChatMessage.name);
    const { senderUserId, sendBirdChannelUrl } = params;

    let origin: ChatMessageOrigin;
    let member: Member;
    let communication: Communication;
    try {
      const user = await this.userService.get(senderUserId);
      if (!user) {
        member = await this.memberService.get(senderUserId);
        if (!member) {
          throw new Error(Errors.get(ErrorType.invalidSenderId));
        }
        origin = ChatMessageOrigin.fromMember;
      } else {
        origin = ChatMessageOrigin.fromUser;
        // getting communication in order to find the memberId
        communication = await this.communicationService.getByChannelUrlAndUser(
          sendBirdChannelUrl,
          user.id,
        );
        if (!communication) {
          throw new Error(Errors.get(ErrorType.communicationMemberUserNotFound));
        }
      }

      if (origin === ChatMessageOrigin.fromUser) {
        const contentKey = ChatInternalKey.newChatMessageFromUser;
        const dispatch: IInternalDispatch = {
          correlationId: getCorrelationId(this.logger),
          dispatchId: generateDispatchId(contentKey, Date.now().toString()),
          recipientClientId: communication.memberId.toString(),
          senderClientId: senderUserId,
          notificationType: NotificationType.text,
          contentKey,
          path: generatePath(
            NotificationType.text,
            contentKey,
            communication.memberId.toString(),
            senderUserId,
          ),
        };
        await this.notifyCreateDispatch(dispatch);
      } else {
        // send text to the member's primary user
        const contentKey = ChatInternalKey.newChatMessageFromMember;
        const dispatch: IInternalDispatch = {
          correlationId: getCorrelationId(this.logger),
          dispatchId: generateDispatchId(contentKey, Date.now().toString()),
          recipientClientId: member.primaryUserId.toString(),
          senderClientId: senderUserId,
          notificationType: NotificationType.textSms,
          contentKey,
        };
        await this.notifyCreateDispatch(dispatch);
      }
    } catch (ex) {
      this.logger.error(params, MemberResolver.name, this.notifyChatMessage.name, formatEx(ex));
    }
  }

  @OnEvent(EventType.notifyDispatch, { async: true })
  async notifyCreateDispatch(createDispatch: IInternalDispatch) {
    this.logger.info(createDispatch, MemberResolver.name, this.notifyCreateDispatch.name);

    const dispatch = {
      type: IrisInnerQueueTypes.createDispatch,
      serviceName: ServiceName.hepius,
      ...createDispatch,
    };

    const eventParams: IEventNotifyQueue = {
      type: QueueType.notifications,
      message: JSON.stringify(dispatch, Object.keys(dispatch).sort()),
    };
    this.eventEmitter.emit(GlobalEventType.notifyQueue, eventParams);
  }

  @OnEvent(EventType.notifyDeleteDispatch, { async: true })
  async notifyDeleteDispatch(params: { dispatchId: string }) {
    this.logger.info(params, MemberResolver.name, this.notifyDeleteDispatch.name);
    const deleteDispatch: IDeleteDispatch = {
      type: IrisInnerQueueTypes.deleteDispatch,
      dispatchId: params.dispatchId,
      correlationId: getCorrelationId(this.logger),
    };
    const eventParams: IEventNotifyQueue = {
      type: QueueType.notifications,
      message: JSON.stringify(deleteDispatch),
    };
    this.eventEmitter.emit(GlobalEventType.notifyQueue, eventParams);
  }

  /**
   * Listening to incoming sms from twilio webhook.
   * Send message from member to chat.
   */
  @OnEvent(EventType.onReceivedTextMessage, { async: true })
  async sendSmsToChat(params: IEventOnReceivedTextMessage) {
    this.logger.info(params, MemberResolver.name, this.sendSmsToChat.name);
    try {
      const isControl = await this.memberService.isControlByPhone(params.phone);
      if (isControl) {
        return;
      }
      const member = await this.memberService.getByPhone(params.phone);
      const sendBirdChannelUrl = await this.getSendBirdChannelUrl({
        memberId: member.id,
        userId: member.primaryUserId.toString(),
      });

      const dispatch: IInternalDispatch = {
        correlationId: getCorrelationId(this.logger),
        dispatchId: generateDispatchId(
          NotifyCustomKey.customContent,
          member.primaryUserId.toString(),
          Date.now().toString(),
        ),
        notificationType: NotificationType.chat,
        recipientClientId: member.primaryUserId.toString(),
        senderClientId: member.id,
        sendBirdChannelUrl,
        contentKey: NotifyCustomKey.customContent,
        content: params.message,
      };
      return this.notifyCreateDispatch(dispatch);
    } catch (ex) {
      this.logger.error(params, MemberResolver.name, this.sendSmsToChat.name, formatEx(ex));
    }
  }

  /**
   * Send an alert to the escalation slack channel on QR submit.
   */
  @OnEvent(EventType.onAlertForQRSubmit, { async: true })
  async handleAlertForQRSubmit(params: IEventOnAlertForQRSubmit) {
    this.logger.info(params, MemberResolver.name, this.handleAlertForQRSubmit.name);
    try {
      const member = await this.memberService.get(params.memberId);
      const primaryUser = member.users.find((user) => user.id === member.primaryUserId.toString());

      const notificationParams: IEventNotifySlack = {
        header: `*High Assessment Score [${member.org.name}]*`,
        message:
          `Alerting results on ` +
          `${params.questionnaireName} for ` +
          `${primaryUser.firstName} ${primaryUser.lastName}’s member - ` +
          `<${hosts.harmony}/details/${member.id}|${this.getMemberInitials(member)}>. ` +
          `Scored a '${params.score}'`,

        icon: SlackIcon.warning,
        channel: SlackChannel.escalation,
      };
      this.eventEmitter.emit(GlobalEventType.notifySlack, notificationParams);

      // if phq-9 alert raised we should notify the escalation team members in person (text message)
      if (
        params.questionnaireType === QuestionnaireType.phq9 &&
        params.score === QuestionnaireAlerts.get(QuestionnaireType.phq9)
      ) {
        (await this.userService.getEscalationGroupUsers()).map((user) => {
          const contentKey = AlertInternalKey.assessmentSubmitAlert;
          const phq9AlertEvent: IInternalDispatch = {
            correlationId: getCorrelationId(this.logger),
            dispatchId: generateDispatchId(contentKey, params.questionnaireResponseId),
            notificationType: NotificationType.textSms,
            recipientClientId: user.id,
            senderClientId: member.id,
            contentKey,
            assessmentName: params.questionnaireName,
            assessmentScore: params.score.toString(),
          };
          this.eventEmitter.emit(EventType.notifyDispatch, phq9AlertEvent);
        });
      }
    } catch (ex) {
      this.logger.error(
        params,
        MemberResolver.name,
        this.handleAlertForQRSubmit.name,
        formatEx(ex),
      );
    }
  }

  private async deleteSchedules(params: IEventMember) {
    try {
      await this.notifyDeleteDispatch({
        dispatchId: generateDispatchId(RegisterInternalKey.newMemberNudge, params.memberId),
      });
      await this.notifyDeleteDispatch({
        dispatchId: generateDispatchId(RegisterInternalKey.newRegisteredMember, params.memberId),
      });
      await this.notifyDeleteDispatch({
        dispatchId: generateDispatchId(
          RegisterInternalKey.newRegisteredMemberNudge,
          params.memberId,
        ),
      });
      await this.notifyDeleteDispatch({
        dispatchId: generateDispatchId(LogInternalKey.logReminder, params.memberId),
      });
      await this.notifyDeleteDispatch({
        dispatchId: generateDispatchId(NotifyCustomKey.customContent, params.memberId),
      });
    } catch (ex) {
      this.logger.error(params, MemberResolver.name, this.deleteSchedules.name, formatEx(ex));
    }
  }

  /************************************************************************************************
   **************************************** Member Internal ***************************************
   ************************************************************************************************/
  @Query(() => MemberConfig)
  @MemberIdParam(MemberIdParamType.id)
  @UseInterceptors(MemberUserRouteInterceptor)
  @Roles(MemberRole.member, UserRole.coach, UserRole.nurse)
  async getMemberConfig(
    @Args(
      'id',
      { type: () => String, nullable: true },
      new IsValidObjectId(Errors.get(ErrorType.memberIdInvalid), { nullable: true }),
    )
    id?: string,
  ) {
    const baseMemberConfig = await this.memberService.getMemberConfig(id);
    const { firstLoggedInAt, lastLoggedInAt } = await this.journeyService.getActive(id);
    return { ...baseMemberConfig, firstLoggedInAt, lastLoggedInAt };
  }

  @Mutation(() => Boolean)
  @Roles(MemberRole.member)
  async updateMemberConfig(
    @Client('roles') roles,
    @Client('_id') memberId,
    @Args(camelCase(UpdateMemberConfigParams.name))
    updateMemberConfigParams: UpdateMemberConfigParams,
  ) {
    if (!roles.includes(MemberRole.member)) {
      throw new Error(Errors.get(ErrorType.memberAllowedOnly));
    }
    updateMemberConfigParams.memberId = memberId;
    const memberConfig = await this.memberService.updateMemberConfig(updateMemberConfigParams);
    this.notifyUpdatedMemberConfig({ memberConfig });
    return memberConfig !== null;
  }

  /*************************************************************************************************
   ******************************************** Helpers ********************************************
   ************************************************************************************************/

  private static getTimezoneDeltaFromZipcode(zipCode?: string): number | undefined {
    if (zipCode) {
      const timeZone = lookup(zipCode);
      return getTimezoneOffset(timeZone) / millisecondsInHour;
    }
  }

  private getMemberInitials(member: Member): string {
    return member.firstName[0].toUpperCase() + member.lastName[0].toUpperCase();
  }

  private async extractDataOfMemberAndUser(
    memberId: string,
    userId: string,
  ): Promise<{ member: Member; memberConfig: MemberConfig; user: User }> {
    const member = await this.memberService.get(memberId);
    if (!member) {
      throw new Error(Errors.get(ErrorType.memberNotFound));
    }
    member.zipCode = member.zipCode || member.org.zipCode;
    const memberConfig = await this.memberService.getMemberConfig(memberId);
    const user = await this.userService.get(userId);
    if (!user) {
      throw new Error(Errors.get(ErrorType.userNotFound));
    }

    return { member, memberConfig, user };
  }

  private async getSendBirdChannelUrl(getCommunicationParams: GetCommunicationParams) {
    const communication = await this.communicationService.get(getCommunicationParams);
    if (!communication) {
      throw new Error(Errors.get(ErrorType.communicationMemberUserNotFound));
    } else {
      return communication.sendBirdChannelUrl;
    }
  }

  private notifyDeletedMemberConfig(id: string, hard: boolean) {
    const settings: IDeleteClientSettings = {
      type: IrisInnerQueueTypes.deleteClientSettings,
      id,
      hard,
    };

    const eventNotifyQueueParams: IEventNotifyQueue = {
      type: QueueType.notifications,
      message: JSON.stringify(settings),
    };
    this.eventEmitter.emit(GlobalEventType.notifyQueue, eventNotifyQueueParams);
  }

  private generateMobileRegistrationDispatch(
    member: Member,
    firstLoggedInAt: Date,
    correlationId: string,
    contentKey: ContentKey,
    amount: number,
  ): IInternalDispatch {
    return {
      correlationId,
      dispatchId: generateDispatchId(contentKey, member.id),
      recipientClientId: member.id,
      senderClientId: member.primaryUserId.toString(),
      notificationType: NotificationType.text,
      contentKey,
      triggersAt: addDays(firstLoggedInAt, amount),
    };
  }

  private extractNotificationTypeAndBaseParams({
    member,
    memberConfig,
    userId,
    contentKey,
    metadata,
  }: {
    member: Member;
    memberConfig: MemberConfig;
    userId: string;
    contentKey: ContentKey;
    metadata: NotifyContentMetadata;
  }): { notificationType: NotificationType; baseParams } {
    let notificationType;
    switch (contentKey) {
      case ExternalKey.setCallPermissions:
      case ExternalKey.addCaregiverDetails:
        if (memberConfig.platform === Platform.web || !memberConfig.isPushNotificationsEnabled) {
          throw new Error(Errors.get(ErrorType.notificationNotAllowedForWebMember));
        }
        notificationType = NotificationType.text;
        return {
          notificationType,
          baseParams: {
            path: generatePath(notificationType, contentKey),
          },
        };
      case ExternalKey.answerQuestionnaire:
        const { questionnaireId } = metadata;
        if (memberConfig.platform === Platform.web || !memberConfig.isPushNotificationsEnabled) {
          throw new Error(Errors.get(ErrorType.notificationNotAllowedForWebMember));
        }
        notificationType = NotificationType.text;
        return {
          notificationType,
          baseParams: {
            path: generatePath(notificationType, contentKey, questionnaireId),
          },
        };
      case ExternalKey.scheduleAppointment:
        if (memberConfig.platform !== Platform.web) {
          throw new Error(Errors.get(ErrorType.notificationNotAllowedForMobileMember));
        }
        const appointments = member.users
          .find((user) => user.id.toString() === userId.toString())
          ?.appointments.filter(
            (appointment) => appointment.status === AppointmentStatus.requested,
          );
        if (appointments.length === 0) {
          throw new Error(Errors.get(ErrorType.notificationNotAllowedNoRequestedAppointment));
        }
        notificationType = NotificationType.textSms;
        return {
          notificationType,
          baseParams: { scheduleLink: appointments[0].link },
        };
    }
  }
}
