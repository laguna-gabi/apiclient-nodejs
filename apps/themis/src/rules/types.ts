import { DynamicFactCallback, EventHandler, FactOptions } from 'json-rules-engine';
import { DynamicFacts } from './facts';
import { Caregiver } from '@argus/hepiusClient';

// todo: fix "any"
export enum TargetEntity {
  barrier = 'barrier',
  carePlan = 'carePlan',
  assessment = 'assessment',
  task = 'task',
}

export enum Action {
  create = 'create',
  delete = 'delete',
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
  name?: string;
  priority?: number;
  onSuccess?: EventHandler;
  onFailure?: EventHandler;
}

export interface EngineEvent {
  type: TargetEntity;
  params?: EventParams;
}

export interface EventParams {
  type: string;
  parentEntity?: TargetEntity;
  parentEntityType?: string;
}

export interface EngineAction {
  memberId: string;
  action: Action;
  id?: string; // for delete
  targetEntity: TargetEntity;
  entityType: string;
  parentEntity?: TargetEntity;
  parentEntityType?: string;
  parentEntityId?: string;
}

export interface LookupResult {
  found: boolean;
  parentId?: string;
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
  caregivers: Caregiver[];
  barriers: Barrier[];
  carePlans: CarePlan[];
}

export interface MemberInfo {
  id: string;
  scheduledAppointments?: number;
  appointmentsToBeScheduled?: number;
  livesAlone?: boolean;
  nested?: { example: number };
}

// todo: get the real statuses from common
export enum BarrierStatus {
  active,
  overcome,
  suspended,
}

// todo: get the real types from common
export interface Barrier {
  id: string;
  type: string;
  status: BarrierStatus;
}

// todo: get the real types from common
export interface CarePlan {
  id: string;
  type: string;
  status: BarrierStatus;
}
