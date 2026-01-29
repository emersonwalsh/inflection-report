import { Injectable } from '@angular/core';
import { createClient, SupabaseClient, Session } from '@supabase/supabase-js';
import { BehaviorSubject, Observable } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class SupabaseService {
  private supabase: SupabaseClient;
  private sessionSubject = new BehaviorSubject<Session | null>(null);
  private initializedSubject = new BehaviorSubject<boolean>(false);

  session$: Observable<Session | null> = this.sessionSubject.asObservable();
  initialized$: Observable<boolean> = this.initializedSubject.asObservable();

  constructor() {
    this.supabase = createClient(
      environment.supabase.url,
      environment.supabase.anonKey
    );

    this.initializeAuth();
  }

  private async initializeAuth(): Promise<void> {
    // Listen for auth state changes
    this.supabase.auth.onAuthStateChange((event, session) => {
      this.sessionSubject.next(session);
    });

    // Check for existing session
    const { data } = await this.supabase.auth.getSession();
    this.sessionSubject.next(data.session);
    this.initializedSubject.next(true);
  }

  /**
   * Send a magic link to the user's email
   */
  async signInWithMagicLink(email: string): Promise<{ error: Error | null }> {
    // Use document.baseURI to get the correct base path (includes /inflection-report/ on GitHub Pages)
    const baseUrl = document.baseURI.replace(/\/$/, ''); // Remove trailing slash
    const { error } = await this.supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${baseUrl}/auth/callback`
      }
    });
    return { error: error as Error | null };
  }

  /**
   * Get the current session
   */
  async getSession(): Promise<Session | null> {
    const { data } = await this.supabase.auth.getSession();
    return data.session;
  }

  /**
   * Check if user has an active session
   */
  isAuthenticated(): boolean {
    return this.sessionSubject.value !== null;
  }

  /**
   * Sign out the current user
   */
  async signOut(): Promise<void> {
    await this.supabase.auth.signOut();
  }

  /**
   * Get the current user's email
   */
  getUserEmail(): string | null {
    return this.sessionSubject.value?.user?.email ?? null;
  }
}
