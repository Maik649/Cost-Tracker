import { form, FormField, email, minLength, maxLength, required } from '@angular/forms/signals';
import { Component, inject, signal } from '@angular/core';
import { Router, RouterLink} from '@angular/router';
import { LoadingSpinner } from '../../components/loading-spinner/loading-spinner';
import {MatInputModule} from '@angular/material/input';
import {MatFormFieldModule} from '@angular/material/form-field';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../services/auth.service';
import {MatCheckboxModule} from '@angular/material/checkbox';
import {MatIconModule} from '@angular/material/icon';

@Component({
  imports: [CommonModule, FormField, LoadingSpinner, MatInputModule, MatFormFieldModule, MatCheckboxModule, RouterLink, MatIconModule],
  standalone: true,
  selector: 'app-login',
  styleUrls: ['./login.scss'],
  templateUrl: './login.html',
  providers: [],
})

export class Login {
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  isRegistering = signal(false);
  isPrivacy= signal(false);
  message = signal('');
  messageType = signal<'error' | 'success' | ''>('');
  rateLimitActive = signal(false);
  submitted = signal(false);
  loading = signal(false);
  loginModel = signal({
    email: '',
    password:'',
    confirmPassword: '',
  });

  async onSubmit(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    this.submitted.set(true);
    this.message.set('');
    this.messageType.set('');
    this.rateLimitActive.set(false);

    if (this.inForm().invalid()) {
      return;
    }

    const credentials = this.loginModel();
    if (this.isRegistering() && credentials.password !== credentials.confirmPassword) {
      this.message.set(credentials.confirmPassword
        ? 'Die Passwörter stimmen nicht überein.'
        : 'Bitte wiederhole dein Passwort.');
      this.messageType.set('error');
      return;
    }

    if (this.isRegistering() && !this.isPrivacy()) {
      this.message.set('Bitte akzeptiere die Datenschutzbestimmungen.');
      this.messageType.set('error');
      return;
    }

    this.loading.set(true);
    try {
      if (this.isRegistering()) {
        await this.auth.signUp(credentials.email, credentials.password);
      } else {
        await this.auth.signIn(credentials.email, credentials.password);
      }
      await this.navigateToDashboard();
    } catch (error) {
      this.showAuthError(error);
    } finally {
      this.loading.set(false);
    }
  }

  async continueAsGuest(): Promise<void> {
    this.message.set('');
    this.messageType.set('');
    this.rateLimitActive.set(false);
    this.loading.set(true);
    try {
      await this.auth.signInAsGuest();
      await this.navigateToDashboard();
    } catch (error) {
      this.showAuthError(error);
    } finally {
      this.loading.set(false);
    }
  }

  async requestPasswordReset(event?: Event): Promise<void> {
    event?.preventDefault();
    if (this.loading()) {
      return;
    }

    this.message.set('');
    this.messageType.set('');
    this.rateLimitActive.set(false);

    if (this.inForm.email().invalid()) {
      this.message.set('Bitte gib zuerst eine gültige E-Mail-Adresse ein.');
      this.messageType.set('error');
      return;
    }

    this.loading.set(true);
    try {
      await this.auth.sendPasswordReset(this.loginModel().email);
      this.showPasswordResetConfirmation();
    } catch (error) {
      if (this.auth.isUnknownEmailError(error)) {
        this.showPasswordResetConfirmation();
      } else {
        this.showAuthError(error);
      }
    } finally {
      this.loading.set(false);
    }
  }

  startRegistration(event?: Event): void {
    event?.preventDefault();
    if (this.loading()) {
      return;
    }

    this.isRegistering.set(true);
    this.message.set('');
    this.messageType.set('');
    this.rateLimitActive.set(false);
    this.submitted.set(false);
    this.isPrivacy.set(false);
    this.loginModel.update(model => ({ ...model, confirmPassword: '' }));
  }

  cancelRegistration(): void {
    this.isRegistering.set(false);
    this.message.set('');
    this.messageType.set('');
    this.rateLimitActive.set(false);
    this.submitted.set(false);
    this.isPrivacy.set(false);
    this.loginModel.update(model => ({ ...model, confirmPassword: '' }));
  }

  private async navigateToDashboard(): Promise<void> {
    const navigated = await this.router.navigateByUrl('/dashboard');
    if (!navigated) {
      this.message.set('Anmeldung erfolgreich, aber das Dashboard konnte nicht geöffnet werden.');
      this.messageType.set('error');
    }
  }

  private showAuthError(error: unknown): void {
    this.message.set(this.auth.authErrorMessage(error));
    this.messageType.set('error');
    this.rateLimitActive.set(this.auth.isRateLimitError(error));
  }

  private showPasswordResetConfirmation(): void {
    this.message.set('Wenn für diese E-Mail-Adresse ein Konto besteht, erhältst du in Kürze eine E-Mail zum Zurücksetzen des Passworts.');
    this.messageType.set('success');
  }

   inForm = form(this.loginModel, (schemaPath) => {
  required(schemaPath.email, {
    message: 'E-Mail ist erforderlich.'
  });

  email(schemaPath.email, {
    message: 'Bitte eine gültige E-Mail eingeben.'
  });

  required(schemaPath.password, {
    message: 'Passwort ist erforderlich.'
  });

  minLength(schemaPath.password, 8, {
    message: 'Das Passwort muss mindestens 8 Zeichen haben.'
  });

  maxLength(schemaPath.password, 30, {
    message: 'Das Passwort darf höchstens 30 Zeichen haben.'
  });
});
}

