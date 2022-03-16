import { IDeleteDispatch, InnerQueueTypes } from '../';
import { v4 } from 'uuid';

export class ObjectDeleteDispatchClass {
  constructor(readonly objectDeleteDispatchMock: IDeleteDispatch) {}
}

export const generateDeleteDispatchMock = ({
  dispatchId = v4(),
}: {
  dispatchId: string;
}): IDeleteDispatch => {
  return {
    type: InnerQueueTypes.deleteDispatch,
    dispatchId: dispatchId,
    correlationId: v4(),
  };
};
