import * as config from 'config';
import { add, differenceInDays, format } from 'date-fns';
import * as jwt from 'jsonwebtoken';
import { ErrorType, Errors } from '.';

// Description: given a date (string format) return a range of dates (string format)
//              from start to start+numberOfDays
export function getListOfDates(
  inStartDate: string,
  inEndDate: string,
  dateFormat?: string,
): string[] {
  const ret: string[] = [];

  if (!dateFormat) {
    dateFormat = config.get('general.dateFormatString');
  }

  const startDate = Date.parse(inStartDate);
  const endDate = Date.parse(inEndDate);

  if (!startDate || !endDate) {
    throw new Error('invalid date format');
  }

  for (let i = 0; i < differenceInDays(endDate, startDate) + 1; i++) {
    ret.push(format(add(startDate, { days: i }), dateFormat));
  }

  return ret;
}

export function reformatDate(date: string, stringFormat: string): string {
  const dateObject = Date.parse(date);

  if (!dateObject) {
    throw new Error(Errors.get(ErrorType.dailyReportQueryDateInvalid));
  }

  return format(dateObject, stringFormat);
}

export const extractAuthorizationHeader = (context) => {
  const authorizationHeader = context.req?.headers?.authorization?.replace('Bearer ', '');
  return jwt.decode(authorizationHeader);
};

export const generateOrgNamePrefix = (orgName?: string): string => {
  return `${orgName ? ` [${orgName}] ` : ''}`;
};
