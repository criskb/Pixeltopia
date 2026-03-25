import Topbar from '../editor/features/chrome/Topbar';
import Workspace from '../editor/features/workspace/Workspace';

export default function AppShell() {
  return (
    <div className="app-shell">
      <Topbar />
      <Workspace />
    </div>
  );
}
