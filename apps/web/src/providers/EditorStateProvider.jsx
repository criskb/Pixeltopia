import { EditorProvider } from '../editor/state/EditorStateContext';

export default function EditorStateProvider({ children }) {
  return <EditorProvider>{children}</EditorProvider>;
}
