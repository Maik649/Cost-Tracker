import { form, FormField, email, minLength, maxLength, required } from '@angular/forms/signals';
import { Component, inject, signal } from '@angular/core';
import { env } from '../../../environments/environment';
import { Router } from '@angular/router';
import { LoadingSpinner } from '../../components/loading-spinner/loading-spinner';
import {MatInputModule} from '@angular/material/input';
import {MatFormFieldModule} from '@angular/material/form-field';
import { CommonModule } from '@angular/common';


@Component({
  imports: [CommonModule, FormField, LoadingSpinner, MatInputModule, MatFormFieldModule],
  standalone: true,
  selector: 'app-login',
  styleUrls: ['./login.scss'],
  templateUrl: './login.html',
  providers: [],
})


export class Login {
  private readonly router = inject(Router);
  message = signal('');
  messageType = signal<'error' | 'success' | ''>('');
  submitted = signal(false);
  loading = signal(false);
  loginModel = signal({
    email: '',
    password:'',
  });

  async onSubmit(event: SubmitEvent) {
    event.preventDefault();
    this.submitted.set(true);
    this.message.set('');
    this.messageType.set('');

    if (this.inForm().invalid()) {
      this.messageType.set('error');
      return;
    }

    const credentials = this.loginModel();
    const emailAddress = credentials.email.trim();
    const validCredentials = env.validCredentials;

    if (
      emailAddress !== validCredentials.email ||
      credentials.password !== validCredentials.password
    ) {
      this.message.set('E-Mail passt nicht zum Passwort.');
      this.messageType.set('error');
      return;
    }

    this.loading.set(true);
    this.message.set('Login erfolgreich.');
    this.messageType.set('success');

    await new Promise<void>((resolve) => setTimeout(resolve, 700));
    const navigated = await this.router.navigateByUrl('/dashboard');
    if (!navigated) {
      this.loading.set(false);
    }
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

