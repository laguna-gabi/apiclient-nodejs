import { Injectable, PipeTransform } from '@nestjs/common';
import { Types } from 'mongoose';

@Injectable()
export class IsValidObjectId implements PipeTransform {
  private message: string;
  private options: { nullable: boolean };

  constructor(message: string, options?: { nullable: boolean }) {
    this.message = message;
    this.options = options;
  }

  transform(value: string) {
    if ((value && !Types.ObjectId.isValid(value)) || (!value && !this.options.nullable)) {
      throw new Error(this.message);
    }

    return value;
  }
}
