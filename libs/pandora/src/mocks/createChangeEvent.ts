import { ChangeEventType, EntityName, IChangeEvent } from '..';
import { v4 } from 'uuid';

export const createChangeEvent = ({
  action = ChangeEventType.updated,
  entity = EntityName.caregiver,
  memberId,
  correlationId = v4(),
}: Partial<IChangeEvent> = {}) => {
  return {
    action,
    entity,
    memberId,
    correlationId,
  };
};
