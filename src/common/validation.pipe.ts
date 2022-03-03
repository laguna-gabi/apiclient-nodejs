import { Injectable, PipeTransform } from '@nestjs/common';
import { Types } from 'mongoose';

@Injectable()
export class IsValidObjectId implements PipeTransform {
  private message: string;

  constructor(message: string) {
    this.message = message;
  }

  transform(value: string) {
    if (!Types.ObjectId.isValid(value)) {
      throw new Error(this.message);
    }

    return value;
  }
}
