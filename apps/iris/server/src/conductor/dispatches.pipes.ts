import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';
import { DispatchDto } from '.';

@Injectable()
export class ParseDispatchProjectionArray implements PipeTransform {
  transform(value: string) {
    value?.split(',').forEach((key) => {
      if (!Object.keys(DispatchDto.paths).includes(key.trim())) {
        throw new BadRequestException(`projection field [${key}] is not part of the schema`);
      }
    });
    return value?.split(',');
  }
}
