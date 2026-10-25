import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { RouterModule } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatToolbarModule } from '@angular/material/toolbar';
import { ButtonComponents } from '../../components/button-components/button-components';

@Component({
  imports: [CommonModule, MatSidenavModule, MatIconModule, MatButtonModule, MatToolbarModule, RouterModule, ButtonComponents],
  selector: 'app-dashboard',
  styleUrls: ['./dashboard.scss'],
  templateUrl: './dashboard.html',
})
export class Dashboard {
  protected readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  async logout(): Promise<void> {
    this.auth.logout();
    await this.router.navigateByUrl('/');
  }

  buttons = [
    { label: 'Kosten Übersicht', routerLink: '/doc-view' },
    { label: 'Kosten Hinzufügen', routerLink: '/add-cost' },
    { label: 'Auswertung', routerLink: '/diagram' },
  ];
}
