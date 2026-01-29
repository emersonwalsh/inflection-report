import { Component, signal, HostListener, computed } from '@angular/core';
import { RouterOutlet, Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { toSignal } from '@angular/core/rxjs-interop';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.scss',
  host: {
    '[class.header-hidden]': '!headerVisible()'
  }
})
export class App {
  protected readonly title = signal('inflection-report');
  protected readonly headerVisible = signal(true);

  private lastScrollY = 0;
  private scrollThreshold = 60; // Header height

  // Track if we're on a full-screen page (login, auth-callback)
  private currentUrl = signal('/');
  protected readonly isFullScreenPage = computed(() => {
    const url = this.currentUrl();
    return url.includes('/login') || url.includes('/auth/callback');
  });

  constructor(private router: Router) {
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe((event: NavigationEnd) => {
      this.currentUrl.set(event.urlAfterRedirects);
    });
  }

  @HostListener('window:scroll')
  onScroll() {
    const currentScrollY = window.scrollY;

    // Always show header at the top of page
    if (currentScrollY < this.scrollThreshold) {
      this.headerVisible.set(true);
      this.lastScrollY = currentScrollY;
      return;
    }

    // Scrolling down - hide header
    if (currentScrollY > this.lastScrollY) {
      this.headerVisible.set(false);
    }
    // Scrolling up - show header
    else if (currentScrollY < this.lastScrollY) {
      this.headerVisible.set(true);
    }

    this.lastScrollY = currentScrollY;
  }
}
