import { Routes } from '@angular/router';
import { Login } from './pages/login/login';
import { LoadingSpinner } from './components/loading-spinner/loading-spinner';
import { Dashboard } from './pages/dashboard/dashboard';
import { DocView } from './pages/doc-view/doc-view';
import { AddCost } from './pages/add-cost/add-cost';
import { Settings } from './pages/settings/settings';


export const routes: Routes = [
  {
  path: '',
  component: Login
},
 {
  path: 'loading',
  component: LoadingSpinner
},
{
  path: 'dashboard',
  component: Dashboard
},
  {
    path: 'doc-view',
    component: DocView
  },
  {
    path: 'add-kosten',
    component: AddCost
  },
  {
    path: 'settings',
    component: Settings
  }
];
