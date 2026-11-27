import { Component, signal, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { MatToolbarModule } from '@angular/material/toolbar';
import { AuthService } from './services/auth.service';
import { Router, ActivatedRoute, RouterModule} from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { SubHeader } from './components/sub-header/sub-header';

import { NavigationEnd } from '@angular/router';
import { filter } from 'rxjs';

type HeaderVariant = 'dashboard' | 'add-cost' | 'doc-view' | 'settings'| 'diagram' | 'privacy' |'none';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, MatToolbarModule, RouterModule, MatIconModule, SubHeader],
  templateUrl: './app.html',
  styleUrl: './app.scss',
  
})
export class App {
  protected readonly title = signal('CostTracker');
   protected readonly auth = inject(AuthService);
     private readonly router = inject(Router);
      private route = inject(ActivatedRoute);
      protected readonly header = signal<HeaderVariant>('none');

   async logout(): Promise<void> {
    this.auth.logout();
    await this.router.navigateByUrl('/');

  // Deine bestehenden inject()-Felder bleiben bestehen.
  }

   constructor() {
    this.router.events
      .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
      .subscribe(() => {
        let activeRoute = this.route;

        while (activeRoute.firstChild) {
          activeRoute = activeRoute.firstChild;
        }

        this.header.set(activeRoute.snapshot.data['header'] ?? 'none');
      });
  }
}
