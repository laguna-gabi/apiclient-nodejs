import { CoachResolver } from '../../src/coach/coach.resolver';
import { CoachService } from '../../src/coach/coach.service';
import { Test, TestingModule } from '@nestjs/testing';
import { CoachModule } from '../../src/coach/coach.module';
import { mockGenerateCoach, generateCreateCoachParams } from '../../test';
import { DbModule } from '../../src/db/db.module';
import { Errors } from '../../src/common';
import { ObjectID } from 'bson';

describe('CoachResolver', () => {
  let resolver: CoachResolver;
  let service: CoachService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [DbModule, CoachModule],
    }).compile();

    resolver = module.get<CoachResolver>(CoachResolver);
    service = module.get<CoachService>(CoachService);
  });

  describe('createCoach', () => {
    let spyOnServiceInsert;
    beforeEach(() => {
      spyOnServiceInsert = jest.spyOn(service, 'insert');
    });

    afterEach(() => {
      spyOnServiceInsert.mockReset();
    });

    it('should create a coach', async () => {
      spyOnServiceInsert.mockImplementationOnce(async () =>
        mockGenerateCoach(),
      );

      const params = generateCreateCoachParams();
      await resolver.createCoach(params);

      expect(spyOnServiceInsert).toBeCalledTimes(1);
      expect(spyOnServiceInsert).toBeCalledWith(params);
    });

    it('should fail to create a coach due to invalid coach role', async () => {
      //@ts-ignore
      const params = generateCreateCoachParams('invalid role');

      await expect(resolver.createCoach(params)).rejects.toThrow(
        `${Errors.coach.create.title} : ${Errors.coach.create.reasons.role}`,
      );

      expect(spyOnServiceInsert).not.toBeCalled();
    });
  });

  describe('getCoach', () => {
    let spyOnServiceGet;
    beforeEach(() => {
      spyOnServiceGet = jest.spyOn(service, 'get');
    });

    afterEach(() => {
      spyOnServiceGet.mockReset();
    });

    it('should get a coach for a given id', async () => {
      const coach = mockGenerateCoach();
      spyOnServiceGet.mockImplementationOnce(async () => coach);

      const result = await resolver.getCoach({
        id: coach._id,
      });

      expect(result).toEqual(coach);
    });

    it('should fetch empty on a non existing coach', async () => {
      spyOnServiceGet.mockImplementationOnce(async () => null);

      const id = new ObjectID();
      const result = await resolver.getCoach({
        id: id.toString(),
      });

      expect(result).toBeNull();
    });
  });
});
