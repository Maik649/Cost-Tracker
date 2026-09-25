import { Routes } from '@angular/router';
import { Login } from './pages/login/login';
import { LoadingSpinner } from './componenten/loading-spinner/loading-spinner';
import { Dashboard } from './pages/dashboard/dashboard';


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
}
];
