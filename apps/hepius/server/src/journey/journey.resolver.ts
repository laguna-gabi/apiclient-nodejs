import { UseInterceptors } from '@nestjs/common';
import {
  Client,
  ErrorType,
  Errors,
  EventType,
  IEventOnPublishedJournal,
  IsValidObjectId,
  LoggerService,
  LoggingInterceptor,
  Roles,
} from '../common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import {
  ActionItem,
  ActionItemStatus,
  Admission,
  AdmissionService,
  AudioType,
  ChangeMemberDnaParams,
  CreateActionItemParams,
  DietaryHelper,
  DietaryMatcher,
  GetMemberUploadJournalAudioLinkParams,
  GetMemberUploadJournalImageLinkParams,
  ImageType,
  Journal,
  JournalUploadAudioLink,
  JournalUploadImageLink,
  Journey,
  JourneyService,
  SetGeneralNotesParams,
  UpdateActionItemStatusParams,
  UpdateJournalTextParams,
  UpdateJourneyParams,
} from '.';
import { Identifier, MemberRole, UserRole } from '@argus/hepiusClient';
import { camelCase } from 'lodash';
import { StorageType } from '@argus/pandora';
import { StorageService } from '../providers';
import { EventEmitter2 } from '@nestjs/event-emitter';

@UseInterceptors(LoggingInterceptor)
@Resolver(() => Journey)
export class JourneyResolver {
  constructor(
    readonly journeyService: JourneyService,
    readonly admissionService: AdmissionService,
    readonly dietaryMatcher: DietaryHelper,
    readonly storageService: StorageService,
    readonly eventEmitter: EventEmitter2,
    readonly logger: LoggerService,
  ) {}

  /************************************************************************************************
   ******************************************** Journey *******************************************
   ************************************************************************************************/
  @Mutation(() => Journey)
  @Roles(UserRole.lagunaCoach, UserRole.lagunaNurse)
  async updateJourney(
    @Args(camelCase(UpdateJourneyParams.name)) params: UpdateJourneyParams,
  ): Promise<Journey> {
    return this.journeyService.update(params);
  }

  @Query(() => [Journey])
  @Roles(UserRole.lagunaCoach, UserRole.lagunaNurse)
  async getJourneys(
    @Args(
      'memberId',
      { type: () => String },
      new IsValidObjectId(Errors.get(ErrorType.memberIdInvalid)),
    )
    memberId: string,
  ): Promise<Journey[]> {
    return this.journeyService.getAll({ memberId });
  }

  @Query(() => Journey)
  @Roles(UserRole.lagunaCoach, UserRole.lagunaNurse)
  async getJourney(
    @Args('id', { type: () => String }, new IsValidObjectId(Errors.get(ErrorType.journeyIdInvalid)))
    id: string,
  ): Promise<Journey> {
    return this.journeyService.get(id);
  }

  @Query(() => Journey, { nullable: true })
  @Roles(UserRole.lagunaCoach, UserRole.lagunaNurse)
  async getRecentJourney(
    @Args(
      'memberId',
      { type: () => String },
      new IsValidObjectId(Errors.get(ErrorType.memberIdInvalid)),
    )
    memberId: string,
  ): Promise<Journey> {
    return this.journeyService.getRecent(memberId);
  }

  /*************************************************************************************************
   ****************************************** General notes ****************************************
   ************************************************************************************************/

  @Mutation(() => Boolean, { nullable: true })
  @Roles(UserRole.lagunaCoach, UserRole.lagunaNurse)
  async setGeneralNotes(
    @Args(camelCase(SetGeneralNotesParams.name)) setGeneralNotesParams: SetGeneralNotesParams,
  ) {
    return this.journeyService.setGeneralNotes(setGeneralNotesParams);
  }

  /*************************************************************************************************
   ****************************************** Action items *****************************************
   ************************************************************************************************/

  @Mutation(() => Identifier)
  @Roles(UserRole.lagunaCoach, UserRole.lagunaNurse)
  async createActionItem(
    @Args(camelCase(CreateActionItemParams.name))
    createActionItemParams: CreateActionItemParams,
  ) {
    return this.journeyService.insertActionItem({
      createActionItemParams,
      status: ActionItemStatus.pending,
    });
  }

  @Mutation(() => Boolean, { nullable: true })
  @Roles(UserRole.lagunaCoach, UserRole.lagunaNurse)
  async updateActionItemStatus(
    @Args(camelCase(UpdateActionItemStatusParams.name))
    updateActionItemStatusParams: UpdateActionItemStatusParams,
  ) {
    return this.journeyService.updateActionItemStatus(updateActionItemStatusParams);
  }

  @Query(() => [ActionItem])
  @Roles(UserRole.lagunaCoach, UserRole.lagunaNurse)
  async getActionItems(
    @Args(
      'memberId',
      { type: () => String, nullable: false },
      new IsValidObjectId(Errors.get(ErrorType.memberIdInvalid), { nullable: true }),
    )
    memberId: string,
  ) {
    return this.journeyService.getActionItems(memberId);
  }
  /************************************************************************************************
   ****************************************** Admission *******************************************
   ************************************************************************************************/
  @Mutation(() => Admission)
  @Roles(UserRole.lagunaCoach, UserRole.lagunaNurse)
  async changeMemberDna(
    @Client('roles') roles,
    @Args(camelCase(ChangeMemberDnaParams.name))
    changeMemberDnaParams: ChangeMemberDnaParams,
  ): Promise<Admission> {
    this.dietaryMatcher.validate(changeMemberDnaParams.dietary);
    return this.admissionService.change(changeMemberDnaParams);
  }

  @Query(() => [Admission])
  @Roles(UserRole.lagunaCoach, UserRole.lagunaNurse)
  async getMemberAdmissions(
    @Args(
      'memberId',
      { type: () => String, nullable: false },
      new IsValidObjectId(Errors.get(ErrorType.memberIdInvalid), { nullable: true }),
    )
    memberId: string,
  ) {
    return this.admissionService.get(memberId);
  }

  @Query(() => DietaryMatcher)
  @Roles(UserRole.lagunaCoach, UserRole.lagunaNurse)
  async getAdmissionsDietaryMatcher() {
    return this.dietaryMatcher.get();
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
    const { id: journeyId } = await this.journeyService.getRecent(memberId);
    return this.journeyService.createJournal(memberId, journeyId);
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
    const { id: journeyId } = await this.journeyService.getRecent(memberId);
    const journal = await this.journeyService.updateJournal({
      ...updateJournalTextParams,
      memberId,
      journeyId,
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
    const { id: journeyId } = await this.journeyService.getRecent(memberId);
    const journal = await this.journeyService.getJournal(id, journeyId);

    return this.addMemberDownloadJournalLinks(journal);
  }

  @Query(() => [Journal])
  @Roles(MemberRole.member)
  async getJournals(@Client('roles') roles, @Client('_id') memberId) {
    if (!roles.includes(MemberRole.member)) {
      throw new Error(Errors.get(ErrorType.memberAllowedOnly));
    }
    const { id: journeyId } = await this.journeyService.getRecent(memberId);
    const journals = await this.journeyService.getJournals(journeyId);

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
      new IsValidObjectId(Errors.get(ErrorType.journeyJournalIdInvalid)),
    )
    id: string,
  ) {
    if (!roles.includes(MemberRole.member)) {
      throw new Error(Errors.get(ErrorType.memberAllowedOnly));
    }
    const { imageFormat, audioFormat } = await this.journeyService.deleteJournal(id, memberId);

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

    const { id: journeyId } = await this.journeyService.getRecent(memberId);
    await this.journeyService.updateJournal({
      id,
      memberId,
      journeyId,
      imageFormat,
      published: false,
    });
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

    const { id: journeyId } = await this.journeyService.getRecent(memberId);
    await this.journeyService.updateJournal({
      id,
      memberId,
      journeyId,
      audioFormat,
      published: false,
    });
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
      new IsValidObjectId(Errors.get(ErrorType.journeyJournalIdInvalid)),
    )
    id: string,
  ) {
    if (!roles.includes(MemberRole.member)) {
      throw new Error(Errors.get(ErrorType.memberAllowedOnly));
    }
    const { imageFormat } = await this.journeyService.getJournal(id, memberId);

    if (!imageFormat) {
      throw new Error(Errors.get(ErrorType.journeyJournalImageNotFound));
    }

    const { id: journeyId } = await this.journeyService.getRecent(memberId);
    await this.journeyService.updateJournal({
      id,
      memberId,
      journeyId,
      imageFormat: null,
      published: false,
    });
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
      new IsValidObjectId(Errors.get(ErrorType.journeyJournalIdInvalid)),
    )
    id: string,
  ) {
    if (!roles.includes(MemberRole.member)) {
      throw new Error(Errors.get(ErrorType.memberAllowedOnly));
    }
    const { audioFormat } = await this.journeyService.getJournal(id, memberId);

    if (!audioFormat) {
      throw new Error(Errors.get(ErrorType.journeyJournalAudioNotFound));
    }

    const { id: journeyId } = await this.journeyService.getRecent(memberId);
    await this.journeyService.updateJournal({
      id,
      memberId,
      journeyId,
      audioFormat: null,
      published: false,
    });
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

    const { id: journeyId } = await this.journeyService.getRecent(memberId);
    const { imageFormat, audioFormat, text } = await this.journeyService.updateJournal({
      id,
      memberId,
      journeyId,
      published: true,
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

    const event: IEventOnPublishedJournal = {
      memberId,
      text,
      journalImageDownloadLink,
      journalAudioDownloadLink,
    };
    this.eventEmitter.emit(EventType.onPublishedJournal, event);
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
}
