export interface MonthlyGrowth {
  month: string;
  value: number | null;
}

export interface CompanyData {
  searchQuery: string;
  ticker: string;
  weekReturn52: number | null;
  peMultiple: number | null;
  monthlyGrowth: MonthlyGrowth[];
  decemberGrowth: number | null;
}

export interface Subsector {
  name: string;
  companies: CompanyData[];
}

export interface Sector {
  name: string;
  subsectors: Subsector[];
}

export interface ReportData {
  title: string;
  date: string;
  dataUpdatedThrough: string;
  sectors: Sector[];
}

export const MONTHS = [
  'Jan \'25', 'Feb \'25', 'Mar \'25', 'Apr \'25', 'May \'25', 'Jun \'25',
  'Jul \'25', 'Aug \'25', 'Sep \'25', 'Oct \'25', 'Nov \'25', 'Dec \'25'
];
