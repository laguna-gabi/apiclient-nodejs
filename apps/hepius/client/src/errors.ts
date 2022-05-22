export enum ErrorType {
  memberIdInvalid = 9224,
  barrierIdInvalid = 10102,
  carePlanTypeInputInvalid = 10107,
  carePlanTypeInvalid = 10108,
}

const objectIdFormat = 'must be a 12 characters string';

export const Errors: Map<ErrorType, string> = new Map([
  [ErrorType.memberIdInvalid.valueOf(), `memberId ${objectIdFormat}`],
  [ErrorType.barrierIdInvalid.valueOf(), 'invalid barrier id'],
  [
    ErrorType.carePlanTypeInputInvalid.valueOf(),
    'invalid care plan type input - must be either id or custom',
  ],
  [ErrorType.carePlanTypeInvalid.valueOf(), 'invalid care plan type'],
]);
