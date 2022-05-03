import { DynamicFactCallback, EventHandler, FactOptions } from 'json-rules-engine';
import { DynamicFacts } from './facts';

// todo: fix "any"

export enum EventType {
  createBarrier = 'createBarrier',
  createCarePlan = 'createCarePlan',
}

export enum RuleType {
  barrier = 'barrier',
  carePlan = 'carePlan',
}

export enum Operator {
  equal = 'equal',
  lessThan = 'lessThan',
  contains = 'contains',
}

export interface DynamicFact {
  id: string;
  //eslint-disable-next-line @typescript-eslint/no-explicit-any
  value?: any;
  options?: FactOptions;
  calculationMethod?: DynamicFactCallback;
}

export interface EngineRule {
  active: boolean;
  conditions: TopLevelCondition;
  event: EngineEvent;
  type: RuleType;
  name?: string;
  priority?: number;
  onSuccess?: EventHandler;
  onFailure?: EventHandler;
}

export interface EngineEvent {
  type: EventType;
  //eslint-disable-next-line @typescript-eslint/no-explicit-any
  params?: any;
}

export class CreateCarePlanEvent implements EngineEvent {
  type = EventType.createCarePlan;
  params: CreateCarePlanParams;
}

export class CreateBarrierEvent implements EngineEvent {
  type = EventType.createBarrier;
  params: CreateBarrierParams;
}

export interface CreateBarrierParams {
  // todo: change to object ID (barrier type)
  type: string;
}

export interface CreateCarePlanParams {
  // todo: change to object ID (barrier type)
  type: string;
  barrierType: string;
}

interface ConditionProperties {
  fact: keyof MemberFacts | DynamicFacts;
  operator: string;
  //eslint-disable-next-line @typescript-eslint/no-explicit-any
  value: { fact: string } | any;
  path?: string;
  priority?: number;
  //eslint-disable-next-line @typescript-eslint/no-explicit-any
  params?: Record<string, any>;
}

type NestedCondition = ConditionProperties | TopLevelCondition;
type AllConditions = { all: NestedCondition[] };
type AnyConditions = { any: NestedCondition[] };
export type TopLevelCondition = AllConditions | AnyConditions;

// todo: setup with real types
export interface MemberFacts {
  memberInfo: MemberInfo;
  caregivers: string[];
  barriers: { type: string; status: BarrierStatus }[];
}

export interface MemberInfo {
  scheduledAppointments: number;
  appointmentsToBeScheduled: number;
  livesAlone: boolean;
  nested: { example: number };
}

// todo: get the real statuses from common
export enum BarrierStatus {
  active,
  overcome,
  suspended,
}
