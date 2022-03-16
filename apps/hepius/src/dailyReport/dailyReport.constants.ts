import { DailyReportCategoryTypes } from '.';

export interface DailyReportCategoryMetadata {
  threshold: number;
  disabled?: boolean;
}

export const DailyReportsMetadata = new Map<DailyReportCategoryTypes, DailyReportCategoryMetadata>([
  [DailyReportCategoryTypes.Pain, { threshold: 3 }],
  [DailyReportCategoryTypes.Mood, { threshold: 2 }],
  [DailyReportCategoryTypes.Sleep, { threshold: 2 }],
  [DailyReportCategoryTypes.Mobility, { threshold: 2 }],
  [DailyReportCategoryTypes.Appetite, { threshold: 2 }],
  [DailyReportCategoryTypes.Energy, { threshold: 1 }],
]);
