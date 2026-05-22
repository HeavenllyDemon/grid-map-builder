import { createHashRouter, Navigate } from 'react-router-dom';
import { LibraryScreen } from './routes/LibraryScreen';
import { EditorScreen } from './routes/EditorScreen';

export const router = createHashRouter([
  { path: '/', element: <LibraryScreen /> },
  { path: '/p/:projectId', element: <EditorScreen /> },
  { path: '*', element: <Navigate to="/" replace /> },
]);
