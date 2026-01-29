import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { SupabaseService } from '../services/supabase.service';
import { map, take, filter, switchMap } from 'rxjs/operators';

export const authGuard: CanActivateFn = () => {
  const supabase = inject(SupabaseService);
  const router = inject(Router);

  // Wait for auth to initialize, then check session
  return supabase.initialized$.pipe(
    filter(initialized => initialized),
    take(1),
    switchMap(() => supabase.session$.pipe(take(1))),
    map(session => {
      if (session) {
        return true;
      }
      // No session - redirect to login page
      router.navigate(['/login']);
      return false;
    })
  );
};
