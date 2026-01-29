import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { SupabaseService } from '../../services/supabase.service';

@Component({
  selector: 'app-auth-callback',
  standalone: true,
  template: `
    <div class="min-h-screen flex items-center justify-center bg-gray-50">
      <div class="text-center">
        <svg class="animate-spin h-8 w-8 mx-auto mb-4 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <p class="text-gray-600">Verifying your email...</p>
      </div>
    </div>
  `
})
export class AuthCallbackComponent implements OnInit {
  constructor(
    private supabase: SupabaseService,
    private router: Router
  ) {}

  async ngOnInit(): Promise<void> {
    // Supabase automatically handles the token exchange from the URL hash
    // Wait a moment for the auth state to update
    const checkAuth = async () => {
      const session = await this.supabase.getSession();
      if (session) {
        // Successfully authenticated - redirect to report
        this.router.navigate(['/']);
      } else {
        // No session - might need to wait for auth state change
        // Subscribe to session changes
        const sub = this.supabase.session$.subscribe(s => {
          if (s) {
            sub.unsubscribe();
            this.router.navigate(['/']);
          }
        });

        // Timeout fallback - redirect to login after 5 seconds
        setTimeout(() => {
          sub.unsubscribe();
          const currentSession = this.supabase.isAuthenticated();
          if (currentSession) {
            this.router.navigate(['/']);
          } else {
            this.router.navigate(['/login'], {
              queryParams: { error: 'verification_failed' }
            });
          }
        }, 5000);
      }
    };

    // Small delay to allow Supabase to process the URL
    setTimeout(checkAuth, 100);
  }
}
