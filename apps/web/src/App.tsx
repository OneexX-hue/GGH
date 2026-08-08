import { Route, Switch } from 'wouter';
import { useLiveUpdates } from '@workspace/api-client';
import { Registration } from './pages/Registration.tsx';
import { Game } from './pages/Game.tsx';
import { Admin } from './pages/Admin.tsx';
import { NotFound } from './pages/not-found.tsx';

export function App() {
  useLiveUpdates();

  return (
    <Switch>
      <Route path="/" component={Registration} />
      <Route path="/game" component={Game} />
      <Route path="/admin" component={Admin} />
      <Route component={NotFound} />
    </Switch>
  );
}
