import { Field, ObjectType } from '@nestjs/graphql';
import { Schema } from '@nestjs/mongoose';
import { Types } from 'mongoose';

@ObjectType()
@Schema()
export class Identifier {
  @Field(() => String)
  id: string;
}

export abstract class BaseService {
  replaceId(object) {
    if (!object) {
      return object;
    }
    object.id = new Types.ObjectId(object._id);
    delete object._id;

    return object;
  }
}
