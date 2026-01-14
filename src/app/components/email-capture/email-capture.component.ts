import { Component, signal, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

const STORAGE_KEY = 'googletrends_email_captured';

const FORMSPREE_ENDPOINT = 'https://formspree.io/f/xreebqzv';

@Component({
  selector: 'app-email-capture',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './email-capture.component.html',
  styleUrl: './email-capture.component.scss'
})
export class EmailCaptureComponent {
  email = signal('');
  isSubmitting = signal(false);
  error = signal('');

  emailCaptured = output<void>();

  async submitEmail(): Promise<void> {
    const emailValue = this.email().trim();

    // Basic validation
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
      const response = await fetch(FORMSPREE_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({ email: emailValue })
      });

      if (response.ok) {
        // Save to localStorage
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
          captured: true,
          email: emailValue,
          timestamp: new Date().toISOString()
        }));

        this.emailCaptured.emit();
      } else {
        this.error.set('Something went wrong. Please try again.');
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

  static hasAlreadyCaptured(): boolean {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const data = JSON.parse(stored);
        return data.captured === true;
      } catch {
        return false;
      }
    }
    return false;
  }
}
