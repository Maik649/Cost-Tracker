import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatToolbarModule } from '@angular/material/toolbar';
import { RouterModule } from '@angular/router';
import { ButtonComponents } from '../../components/button-components/button-components';

@Component({
  imports: [CommonModule, MatSidenavModule, MatIconModule, MatButtonModule, MatToolbarModule, RouterModule, ButtonComponents],
  selector: 'app-dashboard',
  styleUrls: ['./dashboard.scss'],
  templateUrl: './dashboard.html',
})
export class Dashboard {
  buttons = [
    { label: 'Document Viewer', routerLink: '/doc-view' },
    { label: 'Add Kosten', routerLink: '/add-kosten' },
  ];
}
