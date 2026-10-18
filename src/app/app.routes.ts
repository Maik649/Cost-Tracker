import { Routes } from '@angular/router';
import { Login } from './pages/login/login';
import { LoadingSpinner } from './components/loading-spinner/loading-spinner';
import { Dashboard } from './pages/dashboard/dashboard';
import { DocView } from './pages/doc-view/doc-view';
import { AddCost } from './pages/add-cost/add-cost';
import { Settings } from './pages/settings/settings';
import { authGuard } from './guards/auth.guard';

export const routes: Routes = [
  {
    path: '',
    component: Login,
  },
  {
    path: 'loading',
    component: LoadingSpinner,
    canActivate: [authGuard],
  },
  {
    path: 'dashboard',
    component: Dashboard,
    canActivate: [authGuard],
  },
  {
    path: 'doc-view',
    component: DocView,
    canActivate: [authGuard],
  },
  {
    path: 'add-kosten',
    component: AddCost,
    canActivate: [authGuard],
  },
  {
    path: 'settings',
    component: Settings,
    canActivate: [authGuard],
  },
  {
    path: '**',
    redirectTo: '',
  },
];
