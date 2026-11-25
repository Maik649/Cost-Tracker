import { Component, inject, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { AuthService } from '../../services/auth.service';
@Component({
  imports: [CommonModule, RouterModule, MatIconModule],
  selector: 'app-sub-header',
  styleUrls: ['./sub-header.scss'],
  templateUrl: './sub-header.html',
})
export class SubHeader {
  protected readonly auth = inject(AuthService);
  @Input() title = '';
  @Input() subHeaderPath = '';
  @Input() iconName = '';
}
