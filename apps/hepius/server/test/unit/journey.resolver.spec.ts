import { MemberRole, UserRole } from '@argus/hepiusClient';
import { StorageType, generateId, mockLogger, mockProcessWarnings } from '@argus/pandora';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Test, TestingModule } from '@nestjs/testing';
import { lorem } from 'faker';
import { Types } from 'mongoose';
import {
  ErrorType,
  Errors,
  EventType,
  IEventOnPublishedJournal,
  IEventOnReplaceMemberOrg,
  LoggerService,
} from '../../src/common';
import {
  AdmissionService,
  AudioFormat,
  AudioType,
  ImageFormat,
  ImageType,
  Journal,
  JourneyModule,
  JourneyResolver,
  JourneyService,
} from '../../src/journey';
import { OrgService } from '../../src/org';
import { StorageService } from '../../src/providers';
import { dbDisconnect, defaultModules } from '../common';
import {
  generateCreateOrSetActionItemParams,
  generateGetMemberUploadJournalAudioLinkParams,
  generateGetMemberUploadJournalImageLinkParams,
  generateReplaceMemberOrgParams,
  generateSetGeneralNotesParams,
  generateUniqueUrl,
  generateUpdateJournalTextParams,
  generateUpdateJourneyParams,
  mockGenerateActionItem,
  mockGenerateOrg,
} from '../generators';

describe(JourneyResolver.name, () => {
  let module: TestingModule;
  let resolver: JourneyResolver;
  let service: JourneyService;
  let admissionService: AdmissionService;
  let orgService: OrgService;
  let storage: StorageService;
  let eventEmitter: EventEmitter2;

  beforeAll(async () => {
    mockProcessWarnings(); // to hide pino prettyPrint warning
    module = await Test.createTestingModule({
      imports: defaultModules().concat(JourneyModule),
    }).compile();

    resolver = module.get<JourneyResolver>(JourneyResolver);
    service = module.get<JourneyService>(JourneyService);
    admissionService = module.get<AdmissionService>(AdmissionService);
    orgService = module.get<OrgService>(OrgService);
    storage = module.get<StorageService>(StorageService);
    eventEmitter = module.get<EventEmitter2>(EventEmitter2);
    mockLogger(module.get<LoggerService>(LoggerService));
  });

  afterAll(async () => {
    await module.close();
    await dbDisconnect();
  });

  describe('Journey', () => {
    let spyOnServiceUpdate: jest.SpyInstance;
    let spyOnServiceGetAll: jest.SpyInstance;
    let spyOnServiceGet: jest.SpyInstance;
    let spyOnServiceGetRecent: jest.SpyInstance;

    beforeEach(() => {
      spyOnServiceUpdate = jest.spyOn(service, 'update');
      spyOnServiceGetAll = jest.spyOn(service, 'getAll');
      spyOnServiceGet = jest.spyOn(service, 'get');
      spyOnServiceGetRecent = jest.spyOn(service, 'getRecent');
    });

    afterEach(() => {
      spyOnServiceUpdate.mockReset();
      spyOnServiceGetAll.mockReset();
      spyOnServiceGet.mockReset();
      spyOnServiceGetRecent.mockReset();
    });

    it('should update a journey', async () => {
      spyOnServiceUpdate.mockResolvedValueOnce(null);
      await resolver.updateJourney(generateUpdateJourneyParams());

      expect(spyOnServiceUpdate).toBeCalled();
    });

    it('should get all journeys', async () => {
      spyOnServiceGetAll.mockResolvedValueOnce([generateUpdateJourneyParams()]);
      await resolver.getJourneys(generateId());

      expect(spyOnServiceGetAll).toBeCalled();
    });

    it('should get a journey', async () => {
      spyOnServiceGet.mockResolvedValueOnce(generateUpdateJourneyParams());
      await resolver.getJourney(generateId());

      expect(spyOnServiceGet).toBeCalled();
    });

    it('should get recent journey', async () => {
      spyOnServiceGet.mockResolvedValueOnce(generateUpdateJourneyParams());
      await resolver.getRecentJourney(generateId());

      expect(spyOnServiceGetRecent).toBeCalled();
    });
  });

  describe('Admission', () => {
    let spyOnServiceGetMemberAdmission: jest.SpyInstance;
    let spyOnServiceChangeMemberDna: jest.SpyInstance;
    let spyOnServiceGetRecent: jest.SpyInstance;

    beforeEach(() => {
      spyOnServiceGetMemberAdmission = jest.spyOn(admissionService, 'get');
      spyOnServiceChangeMemberDna = jest.spyOn(admissionService, 'change');
      spyOnServiceGetRecent = jest.spyOn(service, 'getRecent');
    });

    afterEach(() => {
      spyOnServiceGetMemberAdmission.mockReset();
      spyOnServiceChangeMemberDna.mockReset();
      spyOnServiceGetRecent.mockReset();
    });

    it('should call get member admission', async () => {
      const memberId = generateId();
      const journeyId = generateId();

      spyOnServiceGetMemberAdmission.mockResolvedValueOnce(undefined);
      spyOnServiceGetRecent.mockResolvedValueOnce({ id: journeyId });

      await resolver.getMemberAdmissions(memberId);

      expect(spyOnServiceGetMemberAdmission).toBeCalledWith({ memberId, journeyId });
    });

    it('should call change member admission', async () => {
      const memberId = generateId();
      const journeyId = generateId();

      spyOnServiceChangeMemberDna.mockResolvedValueOnce(undefined);
      spyOnServiceGetRecent.mockResolvedValueOnce({ id: journeyId });

      await resolver.changeMemberDna([], { memberId });

      expect(spyOnServiceChangeMemberDna).toBeCalledWith({ memberId, journeyId });
    });

    it('should return dietary matcher', async () => {
      const result = await resolver.getAdmissionsDietaryMatcher();
      expect(result.map.length).toEqual(17);
    });
  });

  describe('replaceMemberOrg', () => {
    let spyOnServiceReplaceMemberOrg;
    let spyOnServiceGetRecent;
    let spyOnServiceGetOrg;
    let spyOnEventEmitter;

    beforeEach(() => {
      spyOnServiceReplaceMemberOrg = jest.spyOn(service, 'replaceMemberOrg');
      spyOnServiceGetRecent = jest.spyOn(service, 'getRecent');
      spyOnServiceGetOrg = jest.spyOn(orgService, 'get');
      spyOnEventEmitter = jest.spyOn(eventEmitter, 'emit');
    });

    afterEach(() => {
      spyOnServiceReplaceMemberOrg.mockReset();
      spyOnServiceGetRecent.mockReset();
      spyOnServiceGetOrg.mockReset();
      spyOnEventEmitter.mockReset();
    });

    it('should replace member org', async () => {
      const memberId = generateId();
      const journeyId = generateId();
      const org = mockGenerateOrg();
      spyOnServiceReplaceMemberOrg.mockResolvedValue({ id: journeyId });
      spyOnServiceGetRecent.mockResolvedValue({ id: journeyId });
      spyOnServiceGetOrg.mockResolvedValueOnce(org);
      spyOnEventEmitter.mockResolvedValueOnce();

      const replaceMemberOrgParams = generateReplaceMemberOrgParams({ memberId, orgId: org.id });

      await resolver.replaceMemberOrg(replaceMemberOrgParams);

      expect(spyOnServiceReplaceMemberOrg).toBeCalledWith({ ...replaceMemberOrgParams, journeyId });
      const eventParams: IEventOnReplaceMemberOrg = { memberId, org };
      expect(spyOnEventEmitter).toBeCalledWith(EventType.onReplaceMemberOrg, eventParams);
    });
  });

  describe('setGeneralNotes', () => {
    let spyOnServiceSetGeneralNotes;
    beforeEach(() => {
      spyOnServiceSetGeneralNotes = jest.spyOn(service, 'setGeneralNotes');
    });

    afterEach(() => {
      spyOnServiceSetGeneralNotes.mockReset();
    });

    it('should set general notes', async () => {
      spyOnServiceSetGeneralNotes.mockImplementationOnce(async () => undefined);

      const params = generateSetGeneralNotesParams();
      await resolver.setGeneralNotes(params);

      expect(spyOnServiceSetGeneralNotes).toBeCalledTimes(1);
      expect(spyOnServiceSetGeneralNotes).toBeCalledWith(params);
    });
  });

  describe('ActionItem', () => {
    let spyOnServiceCreateOrSetActionItem;
    beforeEach(() => {
      spyOnServiceCreateOrSetActionItem = jest.spyOn(service, 'createOrSetActionItem');
    });

    afterEach(() => {
      spyOnServiceCreateOrSetActionItem.mockReset();
    });

    it('should set an action item', async () => {
      spyOnServiceCreateOrSetActionItem.mockImplementationOnce(async () =>
        mockGenerateActionItem(),
      );

      const createOrSetActionItem = generateCreateOrSetActionItemParams();
      await resolver.createOrSetActionItem(createOrSetActionItem);

      expect(spyOnServiceCreateOrSetActionItem).toBeCalledTimes(1);
      expect(spyOnServiceCreateOrSetActionItem).toBeCalledWith(createOrSetActionItem);
    });
  });

  describe('journal', () => {
    let spyOnServiceCreateJournal;
    let spyOnServiceUpdateJournal;
    let spyOnServiceGetJournal;
    let spyOnServiceGetJournals;
    let spyOnServiceDeleteJournal;
    let spyOnStorageGetDownloadUrl;
    let spyOnStorageGetUploadUrl;
    let spyOnStorageDeleteFile;
    let spyOnServiceGetRecent;
    let spyOnEventEmitter;

    beforeEach(() => {
      spyOnServiceCreateJournal = jest.spyOn(service, 'createJournal');
      spyOnServiceUpdateJournal = jest.spyOn(service, 'updateJournal');
      spyOnServiceGetJournal = jest.spyOn(service, 'getJournal');
      spyOnServiceGetJournals = jest.spyOn(service, 'getJournals');
      spyOnServiceDeleteJournal = jest.spyOn(service, 'deleteJournal');
      spyOnStorageGetDownloadUrl = jest.spyOn(storage, 'getDownloadUrl');
      spyOnStorageGetUploadUrl = jest.spyOn(storage, 'getUploadUrl');
      spyOnStorageDeleteFile = jest.spyOn(storage, 'deleteFile');
      spyOnServiceGetRecent = jest.spyOn(service, 'getRecent');
      spyOnEventEmitter = jest.spyOn(eventEmitter, 'emit');
    });

    afterEach(() => {
      spyOnServiceCreateJournal.mockReset();
      spyOnServiceUpdateJournal.mockReset();
      spyOnServiceGetJournal.mockReset();
      spyOnServiceGetJournals.mockReset();
      spyOnServiceDeleteJournal.mockReset();
      spyOnStorageGetDownloadUrl.mockReset();
      spyOnStorageGetUploadUrl.mockReset();
      spyOnStorageDeleteFile.mockReset();
      spyOnServiceGetRecent.mockReset();
      spyOnEventEmitter.mockReset();
    });

    const generateMockJournalParams = ({
      id = generateId(),
      memberId = new Types.ObjectId(generateId()),
      journeyId = new Types.ObjectId(generateId()),
      text = lorem.sentence(),
      published = false,
      updatedAt = new Date(),
      createdAt = new Date(),
      imageFormat = ImageFormat.png,
      audioFormat = AudioFormat.mp3,
    }: Partial<Journal> = {}): Journal => {
      return {
        id,
        memberId,
        journeyId,
        text,
        published,
        updatedAt,
        createdAt,
        imageFormat,
        audioFormat,
      };
    };

    it('should create journal', async () => {
      const id = generateId();
      const memberId = generateId();
      const journeyId = generateId();
      spyOnServiceCreateJournal.mockImplementationOnce(async () => id);
      spyOnServiceGetRecent.mockResolvedValueOnce({ id: journeyId });
      const result = await resolver.createJournal([MemberRole.member], memberId);

      expect(spyOnServiceCreateJournal).toBeCalledTimes(1);
      expect(spyOnServiceCreateJournal).toBeCalledWith(memberId, journeyId);
      expect(result).toEqual(id);
    });

    test.each([UserRole.lagunaCoach, UserRole.lagunaNurse, UserRole.lagunaAdmin])(
      'should throw an error on create journal if role = %p',
      async (role) => {
        await expect(resolver.createJournal([role], generateId())).rejects.toThrow(
          Error(Errors.get(ErrorType.memberAllowedOnly)),
        );
      },
    );

    it('should update journal', async () => {
      const params = generateUpdateJournalTextParams();
      const memberId = generateId();
      const journeyId = generateId();
      const journal = generateMockJournalParams({
        ...params,
        memberId: new Types.ObjectId(memberId),
        journeyId: new Types.ObjectId(journeyId),
      });
      const url = generateUniqueUrl();
      spyOnServiceUpdateJournal.mockImplementationOnce(async () => journal);
      spyOnStorageGetDownloadUrl.mockImplementation(async () => url);
      spyOnServiceGetRecent.mockResolvedValue({ id: journeyId });

      const result = await resolver.updateJournalText([MemberRole.member], memberId, params);

      expect(spyOnServiceUpdateJournal).toBeCalledTimes(1);

      expect(spyOnServiceUpdateJournal).toBeCalledWith({
        ...params,
        memberId,
        journeyId,
        published: false,
      });
      expect(spyOnStorageGetDownloadUrl).toBeCalledTimes(3);
      expect(spyOnStorageGetDownloadUrl).toHaveBeenNthCalledWith(1, {
        storageType: StorageType.journals,
        memberId: journal.memberId.toString(),
        id: `${journal.id}${ImageType.NormalImage}.${journal.imageFormat}`,
      });
      expect(spyOnStorageGetDownloadUrl).toHaveBeenNthCalledWith(2, {
        storageType: StorageType.journals,
        memberId: journal.memberId.toString(),
        id: `${journal.id}${ImageType.SmallImage}.${journal.imageFormat}`,
      });
      expect(spyOnStorageGetDownloadUrl).toHaveBeenNthCalledWith(3, {
        storageType: StorageType.journals,
        memberId: journal.memberId.toString(),
        id: `${journal.id}${AudioType}.${journal.audioFormat}`,
      });
      expect(result).toEqual(journal);
    });

    test.each([UserRole.lagunaCoach, UserRole.lagunaNurse, UserRole.lagunaAdmin])(
      'should throw an error on update journal if role = %p',
      async (role) => {
        await expect(
          resolver.updateJournalText([role], generateId(), generateUpdateJournalTextParams()),
        ).rejects.toThrow(Error(Errors.get(ErrorType.memberAllowedOnly)));
      },
    );

    it('should get journal', async () => {
      const memberId = generateId();
      const journal = generateMockJournalParams({ memberId: new Types.ObjectId(memberId) });
      const url = generateUniqueUrl();
      const journeyId = generateId();
      spyOnServiceGetRecent.mockResolvedValueOnce({ id: journeyId });
      spyOnServiceGetJournal.mockImplementationOnce(async () => journal);
      spyOnStorageGetDownloadUrl.mockImplementation(async () => url);

      const result = await resolver.getJournal([MemberRole.member], memberId, journal.id);

      expect(spyOnServiceGetJournal).toBeCalledTimes(1);
      expect(spyOnServiceGetJournal).toBeCalledWith(journal.id, journeyId);
      expect(spyOnStorageGetDownloadUrl).toBeCalledTimes(3);
      expect(spyOnStorageGetDownloadUrl).toHaveBeenNthCalledWith(1, {
        storageType: StorageType.journals,
        memberId: journal.memberId.toString(),
        id: `${journal.id}${ImageType.NormalImage}.${journal.imageFormat}`,
      });
      expect(spyOnStorageGetDownloadUrl).toHaveBeenNthCalledWith(2, {
        storageType: StorageType.journals,
        memberId: journal.memberId.toString(),
        id: `${journal.id}${ImageType.SmallImage}.${journal.imageFormat}`,
      });
      expect(spyOnStorageGetDownloadUrl).toHaveBeenNthCalledWith(3, {
        storageType: StorageType.journals,
        memberId: journal.memberId.toString(),
        id: `${journal.id}${AudioType}.${journal.audioFormat}`,
      });
      expect(result).toEqual(journal);
    });

    // eslint-disable-next-line max-len
    it(`should get journal without image and audio download link if imageFormat and audioFormat doesn't exists`, async () => {
      const memberId = generateId();
      const journeyId = generateId();
      spyOnServiceGetRecent.mockResolvedValueOnce({ id: journeyId });
      const journal = generateMockJournalParams({ memberId: new Types.ObjectId(memberId) });
      delete journal.imageFormat;
      delete journal.audioFormat;
      const url = generateUniqueUrl();
      spyOnServiceGetJournal.mockImplementationOnce(async () => journal);
      spyOnStorageGetDownloadUrl.mockImplementation(async () => url);

      const result = await resolver.getJournal([MemberRole.member], memberId, journal.id);

      expect(spyOnServiceGetJournal).toBeCalledTimes(1);
      expect(spyOnServiceGetJournal).toBeCalledWith(journal.id, journeyId);
      expect(spyOnStorageGetDownloadUrl).toBeCalledTimes(0);
      expect(result).toEqual(journal);
    });

    test.each([UserRole.lagunaCoach, UserRole.lagunaNurse, UserRole.lagunaAdmin])(
      'should throw an error on get journal if role = %p',
      async (role) => {
        await expect(resolver.getJournal([role], generateId(), generateId())).rejects.toThrow(
          Error(Errors.get(ErrorType.memberAllowedOnly)),
        );
      },
    );

    it('should get Journals', async () => {
      const memberId = generateId();
      const journeyId = generateId();
      spyOnServiceGetRecent.mockResolvedValueOnce({ id: journeyId });

      const journals = [
        generateMockJournalParams({
          memberId: new Types.ObjectId(memberId),
          imageFormat: ImageFormat.gif,
          audioFormat: AudioFormat.mp3,
        }),
        generateMockJournalParams({
          memberId: new Types.ObjectId(memberId),
          imageFormat: ImageFormat.png,
          audioFormat: AudioFormat.m4a,
        }),
      ];
      const url = generateUniqueUrl();
      spyOnServiceGetJournals.mockImplementationOnce(async () => journals);
      spyOnStorageGetDownloadUrl.mockImplementation(async () => url);
      const result = await resolver.getJournals([MemberRole.member], memberId);

      expect(spyOnServiceGetJournals).toBeCalledTimes(1);
      expect(spyOnServiceGetJournals).toBeCalledWith(journeyId);
      expect(spyOnStorageGetDownloadUrl).toBeCalledTimes(6);
      expect(spyOnStorageGetDownloadUrl).toHaveBeenNthCalledWith(1, {
        storageType: StorageType.journals,
        memberId,
        id: `${journals[0].id}${ImageType.NormalImage}.${journals[0].imageFormat}`,
      });
      expect(spyOnStorageGetDownloadUrl).toHaveBeenNthCalledWith(2, {
        storageType: StorageType.journals,
        memberId,
        id: `${journals[0].id}${ImageType.SmallImage}.${journals[0].imageFormat}`,
      });
      expect(spyOnStorageGetDownloadUrl).toHaveBeenNthCalledWith(3, {
        storageType: StorageType.journals,
        memberId,
        id: `${journals[1].id}${ImageType.NormalImage}.${journals[1].imageFormat}`,
      });
      expect(spyOnStorageGetDownloadUrl).toHaveBeenNthCalledWith(4, {
        storageType: StorageType.journals,
        memberId,
        id: `${journals[1].id}${ImageType.SmallImage}.${journals[1].imageFormat}`,
      });
      expect(spyOnStorageGetDownloadUrl).toHaveBeenNthCalledWith(5, {
        storageType: StorageType.journals,
        memberId,
        id: `${journals[0].id}${AudioType}.${journals[0].audioFormat}`,
      });
      expect(spyOnStorageGetDownloadUrl).toHaveBeenNthCalledWith(6, {
        storageType: StorageType.journals,
        memberId,
        id: `${journals[1].id}${AudioType}.${journals[1].audioFormat}`,
      });
      expect(result).toEqual(journals);
    });

    test.each([UserRole.lagunaCoach, UserRole.lagunaNurse, UserRole.lagunaAdmin])(
      'should throw an error on get Journals if role = %p',
      async (role) => {
        await expect(resolver.getJournals([role], generateId())).rejects.toThrow(
          Error(Errors.get(ErrorType.memberAllowedOnly)),
        );
      },
    );

    it('should delete Journal with image and audio', async () => {
      const memberId = generateId();
      const journal = generateMockJournalParams({ memberId: new Types.ObjectId(memberId) });
      spyOnServiceDeleteJournal.mockImplementationOnce(async () => journal);
      spyOnStorageDeleteFile.mockImplementationOnce(async () => true);

      const result = await resolver.deleteJournal([MemberRole.member], memberId, journal.id);

      expect(spyOnServiceDeleteJournal).toBeCalledTimes(1);
      expect(spyOnServiceDeleteJournal).toBeCalledWith(journal.id, memberId);
      expect(spyOnStorageDeleteFile).toHaveBeenNthCalledWith(1, {
        id: `${journal.id}${ImageType.SmallImage}.${journal.imageFormat}`,
        memberId,
        storageType: StorageType.journals,
      });
      expect(spyOnStorageDeleteFile).toHaveBeenNthCalledWith(2, {
        id: `${journal.id}${ImageType.NormalImage}.${journal.imageFormat}`,
        memberId,
        storageType: StorageType.journals,
      });
      expect(spyOnStorageDeleteFile).toHaveBeenNthCalledWith(3, {
        memberId,
        storageType: StorageType.journals,
        id: `${journal.id}${AudioType}.${journal.audioFormat}`,
      });
      expect(result).toBeTruthy();
    });

    it('should delete Journal with no image and no audio', async () => {
      const memberId = generateId();
      const journal = generateMockJournalParams({ memberId: new Types.ObjectId(memberId) });
      delete journal.imageFormat;
      delete journal.audioFormat;
      spyOnServiceDeleteJournal.mockImplementationOnce(async () => journal);
      spyOnStorageDeleteFile.mockImplementationOnce(async () => true);

      const result = await resolver.deleteJournal([MemberRole.member], memberId, journal.id);

      expect(spyOnServiceDeleteJournal).toBeCalledTimes(1);
      expect(spyOnServiceDeleteJournal).toBeCalledWith(journal.id, memberId);
      expect(spyOnStorageDeleteFile).toBeCalledTimes(0);
      expect(result).toBeTruthy();
    });

    test.each([UserRole.lagunaCoach, UserRole.lagunaNurse, UserRole.lagunaAdmin])(
      'should throw an error on delete journal if role = %p',
      async (role) => {
        await expect(resolver.deleteJournal([role], generateId(), generateId())).rejects.toThrow(
          Error(Errors.get(ErrorType.memberAllowedOnly)),
        );
      },
    );

    it('should get member upload journal image link', async () => {
      const memberId = generateId();
      const journeyId = generateId();
      const journal = generateMockJournalParams({ memberId: new Types.ObjectId(memberId) });
      const url = generateUniqueUrl();
      spyOnServiceGetRecent.mockResolvedValueOnce({ id: journeyId });
      spyOnServiceUpdateJournal.mockImplementationOnce(async () => journal);
      spyOnStorageGetUploadUrl.mockImplementation(async () => url);

      const params = generateGetMemberUploadJournalImageLinkParams({ id: journal.id });
      const result = await resolver.getMemberUploadJournalImageLink(
        [MemberRole.member],
        memberId,
        params,
      );

      expect(spyOnServiceUpdateJournal).toBeCalledTimes(1);
      expect(spyOnServiceUpdateJournal).toBeCalledWith({
        ...params,
        memberId,
        journeyId,
        published: false,
      });

      expect(spyOnStorageGetUploadUrl).toBeCalledTimes(1);
      expect(spyOnStorageGetUploadUrl).toHaveBeenNthCalledWith(1, {
        storageType: StorageType.journals,
        memberId: journal.memberId.toString(),
        id: `${journal.id}${ImageType.NormalImage}.${params.imageFormat}`,
      });

      expect(result).toEqual({ normalImageLink: url });
    });

    test.each([UserRole.lagunaCoach, UserRole.lagunaNurse, UserRole.lagunaAdmin])(
      'should throw an error on get member upload journal links if role = %p',
      async (role) => {
        await expect(
          resolver.getMemberUploadJournalImageLink(
            [role],
            generateId(),
            generateGetMemberUploadJournalImageLinkParams(),
          ),
        ).rejects.toThrow(Error(Errors.get(ErrorType.memberAllowedOnly)));
      },
    );

    it('should get member upload journal audio link', async () => {
      const memberId = generateId();
      const journeyId = generateId();
      const journal = generateMockJournalParams({ memberId: new Types.ObjectId(memberId) });
      const url = generateUniqueUrl();
      spyOnServiceGetRecent.mockResolvedValueOnce({ id: journeyId });
      spyOnServiceUpdateJournal.mockImplementationOnce(async () => journal);
      spyOnStorageGetUploadUrl.mockImplementationOnce(async () => url);

      const params = generateGetMemberUploadJournalAudioLinkParams({ id: journal.id });
      const result = await resolver.getMemberUploadJournalAudioLink(
        [MemberRole.member],
        memberId,
        params,
      );

      expect(spyOnServiceUpdateJournal).toBeCalledTimes(1);
      expect(spyOnServiceUpdateJournal).toBeCalledWith({
        ...params,
        memberId,
        journeyId,
        published: false,
      });

      expect(spyOnStorageGetUploadUrl).toBeCalledTimes(1);
      expect(spyOnStorageGetUploadUrl).toHaveBeenNthCalledWith(1, {
        storageType: StorageType.journals,
        memberId: journal.memberId.toString(),
        id: `${journal.id}${AudioType}.${journal.audioFormat}`,
      });

      expect(result).toEqual({ audioLink: url });
    });

    test.each([UserRole.lagunaCoach, UserRole.lagunaNurse, UserRole.lagunaAdmin])(
      'should throw an error on get member upload journal links if role = %p',
      async (role) => {
        await expect(
          resolver.getMemberUploadJournalAudioLink(
            [role],
            generateId(),
            generateGetMemberUploadJournalAudioLinkParams(),
          ),
        ).rejects.toThrow(Error(Errors.get(ErrorType.memberAllowedOnly)));
      },
    );

    it('should delete journal images', async () => {
      const memberId = generateId();
      const journeyId = generateId();
      const journal = generateMockJournalParams({ memberId: new Types.ObjectId(memberId) });
      spyOnServiceGetRecent.mockResolvedValueOnce({ id: journeyId });
      spyOnServiceGetJournal.mockImplementationOnce(async () => journal);
      spyOnServiceUpdateJournal.mockImplementationOnce(async () => journal);
      spyOnStorageDeleteFile.mockImplementationOnce(async () => true);

      const result = await resolver.deleteJournalImage([MemberRole.member], memberId, journal.id);

      expect(spyOnServiceUpdateJournal).toBeCalledTimes(1);
      expect(spyOnServiceUpdateJournal).toBeCalledWith({
        id: journal.id,
        imageFormat: null,
        memberId,
        journeyId,
        published: false,
      });
      expect(spyOnStorageDeleteFile).toHaveBeenNthCalledWith(1, {
        id: `${journal.id}${ImageType.SmallImage}.${journal.imageFormat}`,
        memberId,
        storageType: StorageType.journals,
      });
      expect(spyOnStorageDeleteFile).toHaveBeenNthCalledWith(2, {
        id: `${journal.id}${ImageType.NormalImage}.${journal.imageFormat}`,
        memberId,
        storageType: StorageType.journals,
      });
      expect(result).toEqual(true);
    });

    it('should throw an error on delete Journal images if no image', async () => {
      const memberId = generateId();
      const journeyId = generateId();
      const journal = generateMockJournalParams({ memberId: new Types.ObjectId(memberId) });
      delete journal.imageFormat;
      spyOnServiceGetRecent.mockResolvedValueOnce({ id: journeyId });
      spyOnServiceGetJournal.mockImplementationOnce(async () => journal);
      spyOnServiceUpdateJournal.mockImplementationOnce(async () => journal);
      spyOnStorageDeleteFile.mockImplementationOnce(async () => true);

      await expect(
        resolver.deleteJournalImage([MemberRole.member], generateId(), generateId()),
      ).rejects.toThrow(Error(Errors.get(ErrorType.journeyJournalImageNotFound)));
    });

    test.each([UserRole.lagunaCoach, UserRole.lagunaNurse, UserRole.lagunaAdmin])(
      'should throw an error on delete journal image if role = %p',
      async (role) => {
        await expect(
          resolver.deleteJournalImage([role], generateId(), generateId()),
        ).rejects.toThrow(Error(Errors.get(ErrorType.memberAllowedOnly)));
      },
    );

    it('should delete journal audio', async () => {
      const memberId = generateId();
      const journeyId = generateId();
      const journal = generateMockJournalParams({ memberId: new Types.ObjectId(memberId) });
      spyOnServiceGetRecent.mockResolvedValueOnce({ id: journeyId });
      spyOnServiceGetJournal.mockImplementationOnce(async () => journal);
      spyOnServiceUpdateJournal.mockImplementationOnce(async () => journal);
      spyOnStorageDeleteFile.mockImplementationOnce(async () => true);

      const result = await resolver.deleteJournalAudio([MemberRole.member], memberId, journal.id);

      expect(spyOnServiceUpdateJournal).toBeCalledTimes(1);
      expect(spyOnServiceUpdateJournal).toBeCalledWith({
        id: journal.id,
        audioFormat: null,
        memberId,
        journeyId,
        published: false,
      });
      expect(spyOnStorageDeleteFile).toHaveBeenNthCalledWith(1, {
        memberId,
        storageType: StorageType.journals,
        id: `${journal.id}${AudioType}.${journal.audioFormat}`,
      });
      expect(result).toEqual(true);
    });

    it('should throw an error on delete Journal audio if no audio', async () => {
      const memberId = generateId();
      const journeyId = generateId();
      const journal = generateMockJournalParams({ memberId: new Types.ObjectId(memberId) });
      delete journal.audioFormat;
      spyOnServiceGetRecent.mockResolvedValueOnce({ id: journeyId });
      spyOnServiceGetJournal.mockImplementationOnce(async () => journal);
      spyOnServiceUpdateJournal.mockImplementationOnce(async () => journal);
      spyOnStorageDeleteFile.mockImplementationOnce(async () => true);

      await expect(
        resolver.deleteJournalAudio([MemberRole.member], generateId(), generateId()),
      ).rejects.toThrow(Error(Errors.get(ErrorType.journeyJournalAudioNotFound)));
    });

    test.each([UserRole.lagunaCoach, UserRole.lagunaNurse, UserRole.lagunaAdmin])(
      'should throw an error on delete journal audio if role = %p',
      async (role) => {
        await expect(
          resolver.deleteJournalAudio([role], generateId(), generateId()),
        ).rejects.toThrow(Error(Errors.get(ErrorType.memberAllowedOnly)));
      },
    );

    it('should publish Journal', async () => {
      const memberId = generateId();
      const journeyId = generateId();
      const journal = generateMockJournalParams({ memberId: new Types.ObjectId(memberId) });
      const journalImageDownloadLink = generateUniqueUrl();
      const journalAudioDownloadLink = generateUniqueUrl();
      spyOnServiceGetRecent.mockResolvedValueOnce({ id: journeyId });
      spyOnServiceUpdateJournal.mockImplementationOnce(async () => journal);
      spyOnStorageDeleteFile.mockImplementationOnce(async () => true);
      spyOnStorageGetDownloadUrl.mockImplementationOnce(async () => journalImageDownloadLink);
      spyOnStorageGetDownloadUrl.mockImplementationOnce(async () => journalAudioDownloadLink);
      spyOnEventEmitter.mockImplementationOnce(async () => undefined);

      await resolver.publishJournal([MemberRole.member], memberId, journal.id);

      expect(spyOnServiceUpdateJournal).toBeCalledTimes(1);
      expect(spyOnServiceUpdateJournal).toBeCalledWith({
        id: journal.id,
        memberId,
        journeyId,
        published: true,
      });

      expect(spyOnStorageGetDownloadUrl).toBeCalledWith({
        storageType: StorageType.journals,
        memberId,
        id: `${journal.id}${ImageType.NormalImage}.${journal.imageFormat}`,
      });

      const event: IEventOnPublishedJournal = {
        memberId,
        text: journal.text,
        journalAudioDownloadLink,
        journalImageDownloadLink,
      };
      expect(spyOnEventEmitter).toBeCalledWith(EventType.onPublishedJournal, event);
    });

    it('should publish journal with no image', async () => {
      const memberId = generateId();
      const journeyId = generateId();
      const journal = generateMockJournalParams({
        memberId: new Types.ObjectId(memberId),
        imageFormat: null,
      });
      const journalAudioDownloadLink = generateUniqueUrl();
      spyOnServiceGetRecent.mockResolvedValueOnce({ id: journeyId });
      spyOnServiceUpdateJournal.mockImplementationOnce(async () => journal);
      spyOnStorageDeleteFile.mockImplementationOnce(async () => true);
      spyOnStorageGetDownloadUrl.mockImplementationOnce(async () => journalAudioDownloadLink);
      spyOnServiceGetJournal.mockImplementationOnce(async () => journal);
      spyOnEventEmitter.mockImplementationOnce(async () => undefined);

      await resolver.publishJournal([MemberRole.member], memberId, journal.id);

      expect(spyOnStorageGetDownloadUrl).toReturnTimes(1);

      const event: IEventOnPublishedJournal = {
        memberId,
        text: journal.text,
        journalAudioDownloadLink,
      };
      expect(spyOnEventEmitter).toBeCalledWith(EventType.onPublishedJournal, event);
    });

    it('should publish journal with no audio', async () => {
      const memberId = generateId();
      const journeyId = generateId();
      const journal = generateMockJournalParams({
        memberId: new Types.ObjectId(memberId),
        audioFormat: null,
      });
      const journalImageDownloadLink = generateUniqueUrl();
      spyOnServiceGetRecent.mockResolvedValueOnce({ id: journeyId });
      spyOnServiceUpdateJournal.mockImplementationOnce(async () => journal);
      spyOnStorageDeleteFile.mockImplementationOnce(async () => true);
      spyOnStorageGetDownloadUrl.mockImplementationOnce(async () => journalImageDownloadLink);
      spyOnServiceGetJournal.mockImplementationOnce(async () => journal);
      spyOnEventEmitter.mockImplementationOnce(async () => undefined);

      await resolver.publishJournal([MemberRole.member], memberId, journal.id);

      expect(spyOnStorageGetDownloadUrl).toReturnTimes(1);

      const event: IEventOnPublishedJournal = {
        memberId,
        text: journal.text,
        journalImageDownloadLink,
      };
      expect(spyOnEventEmitter).toBeCalledWith(EventType.onPublishedJournal, event);
    });

    it('should publish journal with no audio and no image', async () => {
      const memberId = generateId();
      const journeyId = generateId();
      const journal = generateMockJournalParams({
        memberId: new Types.ObjectId(memberId),
        imageFormat: null,
        audioFormat: null,
      });
      const url = generateUniqueUrl();
      spyOnServiceGetRecent.mockResolvedValueOnce({ id: journeyId });
      spyOnServiceUpdateJournal.mockImplementationOnce(async () => journal);
      spyOnStorageDeleteFile.mockImplementationOnce(async () => true);
      spyOnStorageGetDownloadUrl.mockImplementation(async () => url);
      spyOnServiceGetJournal.mockImplementationOnce(async () => journal);
      spyOnEventEmitter.mockImplementationOnce(async () => undefined);

      await resolver.publishJournal([MemberRole.member], memberId, journal.id);

      expect(spyOnStorageGetDownloadUrl).toReturnTimes(0);

      const event: IEventOnPublishedJournal = { memberId, text: journal.text };
      expect(spyOnEventEmitter).toBeCalledWith(EventType.onPublishedJournal, event);
    });

    test.each([UserRole.lagunaCoach, UserRole.lagunaNurse, UserRole.lagunaAdmin])(
      'should throw an error on publish journal if role = %p',
      async (role) => {
        await expect(resolver.publishJournal([role], generateId(), generateId())).rejects.toThrow(
          Error(Errors.get(ErrorType.memberAllowedOnly)),
        );
      },
    );
  });
});
