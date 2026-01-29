import { Component, signal, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { SupabaseService } from '../../services/supabase.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss'
})
export class LoginComponent implements OnInit {
  private supabase = inject(SupabaseService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  email = signal('');
  isSubmitting = signal(false);
  error = signal('');
  emailSent = signal(false);

  ngOnInit(): void {
    // Check if user is already authenticated
    if (this.supabase.isAuthenticated()) {
      this.router.navigate(['/']);
      return;
    }

    // Check for error query params
    this.route.queryParams.subscribe(params => {
      if (params['error'] === 'verification_failed') {
        this.error.set('Email verification failed. Please try again.');
      }
    });
  }

  async submitEmail(): Promise<void> {
    const emailValue = this.email().trim();

    if (!emailValue) {
      this.error.set('Please enter your email address.');
      return;
    }

    if (!this.isValidEmail(emailValue)) {
      this.error.set('Please enter a valid email address.');
      return;
    }

    this.error.set('');
    this.isSubmitting.set(true);

    try {
      const { error } = await this.supabase.signInWithMagicLink(emailValue);

      if (error) {
        this.error.set(error.message);
      } else {
        this.emailSent.set(true);
      }
    } catch (err) {
      this.error.set('Something went wrong. Please try again.');
    } finally {
      this.isSubmitting.set(false);
    }
  }

  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  resetForm(): void {
    this.emailSent.set(false);
    this.email.set('');
    this.error.set('');
  }
}
