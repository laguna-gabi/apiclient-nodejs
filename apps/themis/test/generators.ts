import {
  Barrier,
  BarrierStatus,
  CarePlan,
  EventParams,
  MemberFacts,
  MemberInfo,
  TargetEntity,
} from '../src/rules/types';
import { Almanac, EngineResult, Event, RuleResult } from 'json-rules-engine';
import { Caregiver } from '@argus/hepiusClient';
import { generateId } from '@argus/pandora';

export const generateEngineResult = ({
  almanac,
  events = [],
  failureEvents = [],
  results = [],
  failureResults = [],
}: {
  almanac?: Almanac;
  events?: Event[];
  failureEvents?: Event[];
  results?: RuleResult[];
  failureResults?: RuleResult[];
}): EngineResult => {
  return {
    almanac,
    events,
    failureEvents,
    results,
    failureResults,
  };
};

export const generateMemberFacts = ({
  barriers = [],
  carePlans = [],
  caregivers = [],
  memberInfo,
}: {
  memberInfo?: MemberInfo;
  caregivers?: Caregiver[];
  barriers?: Barrier[];
  carePlans?: CarePlan[];
}): MemberFacts => {
  return {
    barriers,
    carePlans,
    caregivers,
    memberInfo,
  };
};

export const generateBarrierEventParams = ({
  type = generateId(),
}: {
  type?: string;
}): EventParams => {
  return {
    type,
  };
};

export const generateCarePlanEventParams = ({
  type = generateId(),
  parentEntityType = generateId(),
}: {
  type?: string;
  parentEntityType?: string;
}): EventParams => {
  return {
    type,
    parentEntity: TargetEntity.barrier,
    parentEntityType,
  };
};

export const generateBarrierEvent = ({ type = generateId() }: { type?: string }): Event => {
  return {
    type: TargetEntity.barrier,
    params: generateBarrierEventParams({ type }),
  };
};

export const generateCarePlanEvent = ({
  type = generateId(),
  parentEntityType = generateId(),
}: {
  type?: string;
  parentEntityType?: string;
}): Event => {
  return {
    type: TargetEntity.carePlan,
    params: generateCarePlanEventParams({ type, parentEntityType }),
  };
};

// todo: get shared entities from common
export const generateBarrier = ({ type = generateId() }: { type?: string }): Barrier => {
  return {
    type,
    status: BarrierStatus.active,
  };
};

export const generateCarePlan = ({ type = generateId() }: { type?: string }): CarePlan => {
  return {
    type,
    status: BarrierStatus.active,
  };
};
