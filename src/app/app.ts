import { Component, signal, HostListener } from '@angular/core';
import { RouterOutlet } from '@angular/router';

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
