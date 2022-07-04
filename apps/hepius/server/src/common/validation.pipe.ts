import { Injectable, PipeTransform } from '@nestjs/common';
import { Types } from 'mongoose';

@Injectable()
export class IsValidObjectId implements PipeTransform {
  private readonly message: string;
  private options: { nullable: boolean };

  constructor(message: string, options?: { nullable: boolean }) {
    this.message = message;
    this.options = options;
  }

  transform(value: string | string[]) {
    const inspectedValue = typeof value === 'string' ? [value] : value;

    if (
      (inspectedValue && inspectedValue.find((v) => !Types.ObjectId.isValid(v))) ||
      (!inspectedValue && !this.options.nullable)
    ) {
      throw new Error(this.message);
    }

    return value;
  }
}
