import { Test, TestingModule } from '@nestjs/testing';
import { DbModule } from '../../src/db/db.module';
import * as mongoose from 'mongoose';
import { Coach, CoachRole, CoachSchema } from '../../src/coach/coach.dto';
import { ObjectID } from 'bson';
import { Errors } from '../../src/common';
import { CoachService } from '../../src/coach/coach.service';
import { CoachModule } from '../../src/coach/coach.module';
import { connectToDb, generateCreateCoachParams } from '../index';

describe('CoachService', () => {
  let service: CoachService;
  let model: mongoose.Model<typeof CoachSchema>;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [DbModule, CoachModule],
    }).compile();

    service = module.get<CoachService>(CoachService);

    model = mongoose.model(Coach.name, CoachSchema);

    await connectToDb();
  });

  describe('get', () => {
    it('should return null for non existing coach', async () => {
      const id = new ObjectID();
      const result = await service.get({ id: id.toString() });
      expect(result).toBeNull();
    });

    it('should return coach object for an existing coach', async () => {
      const coach = generateCreateCoachParams();
      const { id } = await model.create(coach);

      const result = await service.get({ id });
      expect(result).toEqual(expect.objectContaining(coach));
    });
  });

  describe('insert', () => {
    test.each([CoachRole.coach, CoachRole.nurse])(
      'should successfully insert a %p',
      async (role) => {
        const coach = generateCreateCoachParams(role);
        const { _id } = await service.insert(coach);

        expect(_id).not.toBeNull();
      },
    );

    it('should fail to insert an already existing coach', async () => {
      const coach = generateCreateCoachParams();
      await service.insert(coach);

      const a = 5;
      await expect(service.insert(coach)).rejects.toThrow(
        `${Errors.coach.create.title} : ${Errors.coach.create.reasons.email}`,
      );
    });
  });
});
