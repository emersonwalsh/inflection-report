import { Component, signal, computed, ViewChild, ElementRef, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Chart, registerables } from 'chart.js';
import { REPORT_DATA } from '../../data/report-data';
import { Sector, Subsector, CompanyData, MONTHS } from '../../models/report.model';

// Register Chart.js components
Chart.register(...registerables);

interface CompanyWithContext extends CompanyData {
  sectorName: string;
  subsectorName: string;
}

type SortColumn = 'searchQuery' | 'ticker' | 'weekReturn52' | 'peMultiple' | 'decemberGrowth' | string;
type SortDirection = 'asc' | 'desc';

interface SortState {
  column: SortColumn;
  direction: SortDirection;
}

@Component({
  selector: 'app-report',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './report.component.html',
  styleUrl: './report.component.scss'
})
export class ReportComponent {
  @ViewChild('chartCanvas') chartCanvas!: ElementRef<HTMLCanvasElement>;

  readonly reportData = REPORT_DATA;
  readonly months = MONTHS;

  searchQuery = signal('');
  selectedCompany = signal<CompanyWithContext | null>(null);

  private chart: Chart | null = null;
  expandedSubsectors = signal<Set<string>>(new Set());

  constructor() {
    // Effect to render chart when selected company changes
    effect(() => {
      const company = this.selectedCompany();
      if (company) {
        // Use setTimeout to ensure the modal DOM is rendered
        setTimeout(() => this.renderChart(company), 0);
      }
    });
  }

  // Sorting state per subsector (key: "sectorName::subsectorName")
  sortStates = signal<Map<string, SortState>>(new Map());

  // Get all companies with their sector/subsector context
  allCompanies = computed<CompanyWithContext[]>(() => {
    const companies: CompanyWithContext[] = [];
    for (const sector of this.reportData.sectors) {
      for (const subsector of sector.subsectors) {
        for (const company of subsector.companies) {
          companies.push({
            ...company,
            sectorName: sector.name,
            subsectorName: subsector.name
          });
        }
      }
    }
    return companies;
  });

  // Top gainers (highest December growth)
  topGainers = computed(() => {
    return [...this.allCompanies()]
      .filter(c => c.decemberGrowth !== null)
      .sort((a, b) => (b.decemberGrowth ?? 0) - (a.decemberGrowth ?? 0))
      .slice(0, 10);
  });

  // Top decliners (lowest December growth)
  topDecliners = computed(() => {
    return [...this.allCompanies()]
      .filter(c => c.decemberGrowth !== null)
      .sort((a, b) => (a.decemberGrowth ?? 0) - (b.decemberGrowth ?? 0))
      .slice(0, 10);
  });

  // Filter sectors based on search
  filteredSectors = computed(() => {
    const query = this.searchQuery().toLowerCase().trim();
    if (!query) {
      return this.reportData.sectors;
    }

    return this.reportData.sectors.map(sector => ({
      ...sector,
      subsectors: sector.subsectors.map(subsector => ({
        ...subsector,
        companies: subsector.companies.filter(company =>
          company.searchQuery.toLowerCase().includes(query) ||
          company.ticker.toLowerCase().includes(query)
        )
      })).filter(subsector => subsector.companies.length > 0)
    })).filter(sector => sector.subsectors.length > 0);
  });

  // Check if there are any search results
  hasSearchResults = computed(() => {
    const query = this.searchQuery().toLowerCase().trim();
    if (!query) return true;
    return this.filteredSectors().some(s => s.subsectors.some(sub => sub.companies.length > 0));
  });

  // Count total matching companies
  matchingCompaniesCount = computed(() => {
    let count = 0;
    for (const sector of this.filteredSectors()) {
      for (const subsector of sector.subsectors) {
        count += subsector.companies.length;
      }
    }
    return count;
  });

  toggleSubsector(sectorName: string, subsectorName: string): void {
    const key = `${sectorName}::${subsectorName}`;
    const current = this.expandedSubsectors();
    const newSet = new Set(current);
    if (newSet.has(key)) {
      newSet.delete(key);
    } else {
      newSet.add(key);
    }
    this.expandedSubsectors.set(newSet);
  }

  isSubsectorExpanded(sectorName: string, subsectorName: string): boolean {
    const key = `${sectorName}::${subsectorName}`;
    return this.expandedSubsectors().has(key);
  }

  expandAll(): void {
    const allKeys = new Set<string>();
    for (const sector of this.reportData.sectors) {
      for (const subsector of sector.subsectors) {
        allKeys.add(`${sector.name}::${subsector.name}`);
      }
    }
    this.expandedSubsectors.set(allKeys);
  }

  collapseAll(): void {
    this.expandedSubsectors.set(new Set());
  }

  clearSearch(): void {
    this.searchQuery.set('');
  }

  onSearchInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.searchQuery.set(input.value);
  }

  // Sorting methods
  getSortState(sectorName: string, subsectorName: string): SortState | undefined {
    const key = `${sectorName}::${subsectorName}`;
    return this.sortStates().get(key);
  }

  toggleSort(sectorName: string, subsectorName: string, column: SortColumn): void {
    const key = `${sectorName}::${subsectorName}`;
    const currentStates = new Map(this.sortStates());
    const currentState = currentStates.get(key);

    let newDirection: SortDirection = 'desc';
    if (currentState?.column === column) {
      // Toggle direction if same column
      newDirection = currentState.direction === 'desc' ? 'asc' : 'desc';
    }

    currentStates.set(key, { column, direction: newDirection });
    this.sortStates.set(currentStates);
  }

  getSortedCompanies(sectorName: string, subsectorName: string, companies: CompanyData[]): CompanyData[] {
    const sortState = this.getSortState(sectorName, subsectorName);
    if (!sortState) {
      return companies;
    }

    const { column, direction } = sortState;
    const multiplier = direction === 'asc' ? 1 : -1;

    return [...companies].sort((a, b) => {
      let aVal: any;
      let bVal: any;

      // Check if sorting by a month column
      if (column.startsWith("month_")) {
        const monthIndex = parseInt(column.split('_')[1], 10);
        aVal = a.monthlyGrowth[monthIndex]?.value;
        bVal = b.monthlyGrowth[monthIndex]?.value;
      } else {
        switch (column) {
          case 'searchQuery':
            return multiplier * a.searchQuery.localeCompare(b.searchQuery);
          case 'ticker':
            return multiplier * a.ticker.localeCompare(b.ticker);
          case 'weekReturn52':
            aVal = a.weekReturn52;
            bVal = b.weekReturn52;
            break;
          case 'peMultiple':
            aVal = a.peMultiple;
            bVal = b.peMultiple;
            break;
          case 'decemberGrowth':
            aVal = a.decemberGrowth;
            bVal = b.decemberGrowth;
            break;
          default:
            return 0;
        }
      }

      // Handle null values - push to end
      if (aVal === null && bVal === null) return 0;
      if (aVal === null) return 1;
      if (bVal === null) return -1;

      return multiplier * (aVal - bVal);
    });
  }

  isSortedBy(sectorName: string, subsectorName: string, column: SortColumn): boolean {
    const state = this.getSortState(sectorName, subsectorName);
    return state?.column === column;
  }

  getSortDirection(sectorName: string, subsectorName: string, column: SortColumn): SortDirection | null {
    const state = this.getSortState(sectorName, subsectorName);
    if (state?.column === column) {
      return state.direction;
    }
    return null;
  }

  getGrowthClass(value: number | null): string {
    if (value === null) return 'growth-neutral';
    if (value >= 50) return 'growth-positive-high';
    if (value >= 20) return 'growth-positive-medium';
    if (value > 0) return 'growth-positive-low';
    if (value >= -20) return 'growth-negative-low';
    if (value >= -50) return 'growth-negative-medium';
    return 'growth-negative-high';
  }

  formatValue(value: number | null): string {
    if (value === null) return '-';
    return value > 0 ? `+${value}%` : `${value}%`;
  }

  formatReturn(value: number | null): string {
    if (value === null) return '-';
    return value > 0 ? `+${value}%` : `${value}%`;
  }

  formatPE(value: number | null): string {
    if (value === null) return '-';
    return `${value}x`;
  }

  // Chart methods
  selectCompany(company: CompanyData, sectorName: string, subsectorName: string): void {
    const companyWithContext: CompanyWithContext = {
      ...company,
      sectorName,
      subsectorName
    };
    this.selectedCompany.set(companyWithContext);
  }

  closeChart(): void {
    if (this.chart) {
      this.chart.destroy();
      this.chart = null;
    }
    this.selectedCompany.set(null);
  }

  private renderChart(company: CompanyWithContext): void {
    if (!this.chartCanvas) return;

    const canvas = this.chartCanvas.nativeElement;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Destroy existing chart
    if (this.chart) {
      this.chart.destroy();
    }

    const labels = this.months;
    const data = company.monthlyGrowth.map(m => m.value);

    // Create gradient
    const gradient = ctx.createLinearGradient(0, 0, 0, 300);
    gradient.addColorStop(0, 'rgba(59, 130, 246, 0.3)');
    gradient.addColorStop(1, 'rgba(59, 130, 246, 0.0)');

    this.chart = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: 'YoY Growth %',
          data,
          borderColor: 'rgb(59, 130, 246)',
          backgroundColor: gradient,
          borderWidth: 2,
          fill: true,
          tension: 0.3,
          pointRadius: 4,
          pointHoverRadius: 6,
          pointBackgroundColor: 'rgb(59, 130, 246)',
          pointBorderColor: '#fff',
          pointBorderWidth: 2,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            titleColor: '#fff',
            bodyColor: '#fff',
            padding: 12,
            displayColors: false,
            callbacks: {
              label: (context) => {
                const value = context.parsed.y;
                if (value === null) return 'N/A';
                return value > 0 ? `+${value}%` : `${value}%`;
              }
            }
          }
        },
        scales: {
          x: {
            grid: {
              color: 'rgba(0, 0, 0, 0.05)'
            },
            ticks: {
              font: {
                size: 11
              }
            }
          },
          y: {
            grid: {
              color: 'rgba(0, 0, 0, 0.05)'
            },
            ticks: {
              callback: (value) => `${value}%`,
              font: {
                size: 11
              }
            }
          }
        },
        interaction: {
          intersect: false,
          mode: 'index'
        }
      }
    });
  }
}
