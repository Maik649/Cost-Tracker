import { Component, Input } from '@angular/core';
import { CommonModule, NgOptimizedImage } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
@Component({
  imports: [CommonModule, RouterModule, MatIconModule],
  selector: 'app-sub-header',
  styleUrls: ['./sub-header.scss'],
  templateUrl: './sub-header.html',
})
export class SubHeader {
  @Input() title = '';
  @Input() subHeaderPath = '';
  @Input() iconName = '';
}
