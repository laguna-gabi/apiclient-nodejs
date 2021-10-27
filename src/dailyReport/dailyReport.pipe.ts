import { Injectable, PipeTransform } from '@nestjs/common';
import { DailyReportCategoriesInput, DailyReportQueryInput } from '.';
import { reformatDate } from '../common/utils';
import * as config from 'config';

@Injectable()
export class ParseDailyReportInputTransform implements PipeTransform {
  transform(value: DailyReportCategoriesInput | DailyReportQueryInput) {
    const dateFormatString = config.get('general.dateFormatString');
    if (value instanceof DailyReportCategoriesInput) {
      value.date = reformatDate(value.date, dateFormatString);
    }
    if (value instanceof DailyReportQueryInput) {
      value.endDate = reformatDate(value.endDate, dateFormatString);
      value.startDate = reformatDate(value.startDate, dateFormatString);
    }
    return value;
  }
}
