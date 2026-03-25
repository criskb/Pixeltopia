import AppProviders from '../providers/AppProviders';
import AppRoutes from '../routes/AppRoutes';

export default function App() {
  return (
    <AppProviders>
      <AppRoutes />
    </AppProviders>
  );
}
