import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';

@Component({
  imports: [FormsModule, CommonModule],
  selector: 'app-login',
  styleUrls: ['./login.scss'],
  templateUrl: './login.html',
})
export class Login {
  email = signal('');
  password = signal('');
  valid = signal(false);
  invalidMessage = signal('');

  constructor() {
    this.valid.set(false);
    this.invalidMessage.set('');
  }
  onSubmit() {
    if (!this.email().trim() || !this.password().trim() ) {
      console.error('Email and password are required.');
      this.invalidMessage.set('Email and password are required.');
      this.valid.set(false);
      return;
    }else{
      this.valid.set(true);
      this.invalidMessage.set('');
      console.log('Form is valid.');
    }
    console.log('Email:', this.email());
    console.log('Password:', this.password());
  }
}
