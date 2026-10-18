import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatToolbarModule } from '@angular/material/toolbar';
import { RouterModule } from '@angular/router';
import { ButtonComponents } from '../../components/button-components/button-components';
import { AuthService } from '../../services/auth.service';
import { Router } from '@angular/router';
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
    { label: 'Hinzufügen Kosten', routerLink: '/add-kosten' },
  ];
}
