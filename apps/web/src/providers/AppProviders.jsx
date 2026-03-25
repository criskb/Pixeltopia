import EditorStateProvider from './EditorStateProvider';
import HotkeysProvider from './HotkeysProvider';
import PersistenceProvider from './PersistenceProvider';

export default function AppProviders({ children }) {
  return (
    <EditorStateProvider>
      <PersistenceProvider>
        <HotkeysProvider>{children}</HotkeysProvider>
      </PersistenceProvider>
    </EditorStateProvider>
  );
}
