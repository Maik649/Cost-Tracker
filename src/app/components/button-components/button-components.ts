import { Component, computed, input, output } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'monthButton' | 'button-gradient';
export type ButtonType = 'button' | 'submit';

@Component({  
  imports: [MatIconModule, RouterLink],
  selector: 'app-button-components',
  styleUrls: ['./button-components.scss'],
  templateUrl: './button-components.html',
})
export class ButtonComponents {
  label = input.required<string>();
  hasLabel = computed(() => this.label().trim().length > 0);
  routerLink = input<string | null>(null);
  buttonType = input<ButtonType>('button');
  variant = input<ButtonVariant>('secondary');
  buttonGradient = input<ButtonVariant>('button-gradient');
  monthButton = input<ButtonVariant>('monthButton');
  iconName = input<string | null>(null);
  ariaLabel = input<string | null>(null);
  buttonClick = output<void>();
}
