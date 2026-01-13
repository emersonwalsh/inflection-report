import { Component, signal, computed, ViewChild, ElementRef, effect, AfterViewInit, OnDestroy, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Chart, registerables } from 'chart.js';
import { REPORT_DATA } from '../../data/report-data';
import { Sector, Subsector, CompanyData, MONTHS } from '../../models/report.model';

// Register Chart.js components
Chart.register(...registerables);

// Configurable: Maximum number of companies to show in Top Gainers/Decliners
const TOP_LIST_MAX_COUNT = 100;
const TOP_LIST_PAGE_SIZE = 10;

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
export class ReportComponent implements AfterViewInit, OnDestroy {
  @ViewChild('chartCanvas') chartCanvas!: ElementRef<HTMLCanvasElement>;

  readonly reportData = REPORT_DATA;
  readonly months = MONTHS;

  searchQuery = signal('');
  selectedCompany = signal<CompanyWithContext | null>(null);

  // Pagination for Top Gainers/Decliners
  gainersPage = signal(0);
  declinersPage = signal(0);
  readonly pageSize = TOP_LIST_PAGE_SIZE;

  // Sector navigation
  activeSector = signal<string>('');
  mobileMenuOpen = signal(false);
  private sectorObserver: IntersectionObserver | null = null;

  private chart: Chart | null = null;
  expandedSubsectors = signal<Set<string>>(new Set());

  constructor(private ngZone: NgZone) {
    // Expand the first subsector by default
    const firstSector = this.reportData.sectors[0];
    if (firstSector && firstSector.subsectors[0]) {
      const key = `${firstSector.name}::${firstSector.subsectors[0].name}`;
      this.expandedSubsectors.set(new Set([key]));
    }

    // Set initial active sector
    if (firstSector) {
      this.activeSector.set(firstSector.name);
    }

    // Effect to render chart when selected company changes
    effect(() => {
      const company = this.selectedCompany();
      if (company) {
        // Use setTimeout to ensure the modal DOM is rendered
        setTimeout(() => this.renderChart(company), 0);
      }
    });

    // Effect to auto-expand subsectors when searching
    effect(() => {
      const query = this.searchQuery().toLowerCase().trim();
      if (query) {
        // Find all subsectors with matching companies and expand them
        const keysToExpand = new Set<string>();
        for (const sector of this.reportData.sectors) {
          for (const subsector of sector.subsectors) {
            const hasMatch = subsector.companies.some(company =>
              company.searchQuery.toLowerCase().includes(query) ||
              company.ticker.toLowerCase().includes(query)
            );
            if (hasMatch) {
              keysToExpand.add(`${sector.name}::${subsector.name}`);
            }
          }
        }
        if (keysToExpand.size > 0) {
          this.expandedSubsectors.set(keysToExpand);
        }
      }
    });
  }

  ngAfterViewInit(): void {
    this.setupSectorObserver();
  }

  ngOnDestroy(): void {
    if (this.sectorObserver) {
      this.sectorObserver.disconnect();
    }
  }

  private setupSectorObserver(): void {
    // Use IntersectionObserver to detect which sector is in view
    this.sectorObserver = new IntersectionObserver(
      (entries) => {
        // Find the entry that is most visible
        const visibleEntries = entries.filter(e => e.isIntersecting);
        if (visibleEntries.length > 0) {
          // Sort by intersection ratio to find the most visible
          visibleEntries.sort((a, b) => b.intersectionRatio - a.intersectionRatio);
          const sectorName = visibleEntries[0].target.getAttribute('data-sector');
          if (sectorName) {
            this.ngZone.run(() => {
              this.activeSector.set(sectorName);
            });
          }
        }
      },
      {
        root: null,
        rootMargin: '-20% 0px -60% 0px',
        threshold: [0, 0.25, 0.5, 0.75, 1]
      }
    );

    // Observe all sector sections after a short delay to ensure DOM is ready
    setTimeout(() => {
      const sectorElements = document.querySelectorAll('[data-sector]');
      sectorElements.forEach(el => this.sectorObserver?.observe(el));
    }, 100);
  }

  scrollToSector(sectorName: string): void {
    const element = document.querySelector(`[data-sector="${sectorName}"]`);
    if (element) {
      const headerOffset = 180; // Account for sticky headers
      const elementPosition = element.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - headerOffset;

      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth'
      });
    }
    this.mobileMenuOpen.set(false);
  }

  toggleMobileMenu(): void {
    this.mobileMenuOpen.set(!this.mobileMenuOpen());
  }

  getSectorId(sectorName: string): string {
    return sectorName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
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

  // All top gainers (highest December growth) - only positive growth, up to max
  allTopGainers = computed(() => {
    return [...this.allCompanies()]
      .filter(c => c.decemberGrowth !== null && c.decemberGrowth > 0)
      .sort((a, b) => (b.decemberGrowth ?? 0) - (a.decemberGrowth ?? 0))
      .slice(0, TOP_LIST_MAX_COUNT);
  });

  // All top decliners (lowest December growth) - only negative growth, up to max
  allTopDecliners = computed(() => {
    return [...this.allCompanies()]
      .filter(c => c.decemberGrowth !== null && c.decemberGrowth < 0)
      .sort((a, b) => (a.decemberGrowth ?? 0) - (b.decemberGrowth ?? 0))
      .slice(0, TOP_LIST_MAX_COUNT);
  });

  // Paginated top gainers for display
  topGainers = computed(() => {
    const start = this.gainersPage() * this.pageSize;
    return this.allTopGainers().slice(start, start + this.pageSize);
  });

  // Paginated top decliners for display
  topDecliners = computed(() => {
    const start = this.declinersPage() * this.pageSize;
    return this.allTopDecliners().slice(start, start + this.pageSize);
  });

  // Total pages for gainers
  gainersTotalPages = computed(() => {
    return Math.ceil(this.allTopGainers().length / this.pageSize);
  });

  // Total pages for decliners
  declinersTotalPages = computed(() => {
    return Math.ceil(this.allTopDecliners().length / this.pageSize);
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

  // Pagination methods for Top Gainers/Decliners
  nextGainersPage(): void {
    if (this.gainersPage() < this.gainersTotalPages() - 1) {
      this.gainersPage.set(this.gainersPage() + 1);
    }
  }

  prevGainersPage(): void {
    if (this.gainersPage() > 0) {
      this.gainersPage.set(this.gainersPage() - 1);
    }
  }

  nextDeclinersPage(): void {
    if (this.declinersPage() < this.declinersTotalPages() - 1) {
      this.declinersPage.set(this.declinersPage() + 1);
    }
  }

  prevDeclinersPage(): void {
    if (this.declinersPage() > 0) {
      this.declinersPage.set(this.declinersPage() - 1);
    }
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
    const formatted = value.toLocaleString();
    return value > 0 ? `+${formatted}%` : `${formatted}%`;
  }

  formatReturn(value: number | null): string {
    if (value === null) return '-';
    const formatted = value.toLocaleString();
    return value > 0 ? `+${formatted}%` : `${formatted}%`;
  }

  formatPE(value: number | null): string {
    if (value === null) return '-';
    return `${value.toLocaleString()}x`;
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
      plugins: [{
        id: 'zeroLine',
        beforeDraw: (chart: any) => {
          const ctx = chart.ctx;
          const yAxis = chart.scales.y;
          const xAxis = chart.scales.x;
          const y = yAxis.getPixelForValue(0);

          if (y >= yAxis.top && y <= yAxis.bottom) {
            ctx.save();
            ctx.beginPath();
            ctx.moveTo(xAxis.left, y);
            ctx.lineTo(xAxis.right, y);
            ctx.strokeStyle = 'rgba(0, 0, 0, 0.4)';
            ctx.lineWidth = 1.5;
            ctx.setLineDash([6, 4]);
            ctx.stroke();
            ctx.restore();
          }
        }
      }],
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
                const formatted = value.toLocaleString();
                return value > 0 ? `+${formatted}%` : `${formatted}%`;
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
              callback: (value) => `${Number(value).toLocaleString()}%`,
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
