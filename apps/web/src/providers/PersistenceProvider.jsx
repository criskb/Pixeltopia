import { useEffect } from 'react';

const LAST_SESSION_KEY = 'pixelforge.session.lastSeenAt';

export default function PersistenceProvider({ children }) {
  useEffect(() => {
    window.localStorage?.setItem(LAST_SESSION_KEY, new Date().toISOString());
  }, []);

  return children;
}
