import { useEffect, useState } from 'react';
import Topbar from '../editor/features/chrome/Topbar';
import Workspace from '../editor/features/workspace/Workspace';

export default function AppShell() {
  const [viewport, setViewport] = useState(() => ({
    width: typeof window !== 'undefined' ? window.innerWidth : 1280,
    height: typeof window !== 'undefined' ? window.innerHeight : 900
  }));

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }
    const onResize = () => {
      setViewport({
        width: window.innerWidth,
        height: window.innerHeight
      });
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const shellClassName = [
    'app-shell',
    viewport.width < 1200 ? 'compact-width' : '',
    viewport.height < 820 ? 'compact-height' : ''
  ].filter(Boolean).join(' ');

  return (
    <div className={shellClassName}>
      <Topbar />
      <Workspace />
    </div>
  );
}
