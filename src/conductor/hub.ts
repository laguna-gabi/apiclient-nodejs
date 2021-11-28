import { Injectable } from '@nestjs/common';
import { Dispatch } from '.';

@Injectable()
export class Hub {
  async notify(dispatch: Dispatch) {
    console.log(dispatch);
  }
}
