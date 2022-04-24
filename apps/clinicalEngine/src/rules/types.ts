import { DynamicFactCallback, EventHandler, FactOptions } from 'json-rules-engine';
import { DynamicFacts } from './facts';

// todo: fix "any"

export enum EventType {
  createBarrier = 'createBarrier',
  createCarePlan = 'createCarePlan',
}

export enum Operator {
  equal = 'equal',
  lessThan = 'lessThan',
  contains = 'contains',
}

export enum Priority {
  barrier = 10,
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
  event: Event;
  name?: string;
  priority?: Priority;
  onSuccess?: EventHandler;
  onFailure?: EventHandler;
}

export interface Event {
  type: EventType;
  //eslint-disable-next-line @typescript-eslint/no-explicit-any
  params?: Record<string, any>;
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
  barriers: { type: string }[];
}

export interface MemberInfo {
  scheduledAppointments: number;
  appointmentsToBeScheduled: number;
  livesAlone: boolean;
  nested: { example: number };
}
