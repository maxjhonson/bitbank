import { Route, Routes } from 'react-router-dom'
import { AppShell } from './features/shell/AppShell'
import { NotFoundPage } from './features/NotFoundPage'
import { LibraryPage } from './features/library/LibraryPage'
import { JokeEditorPage } from './features/joke/JokeEditorPage'
import { SetListPage } from './features/sets/SetListPage'
import { SetBuilderPage } from './features/sets/SetBuilderPage'
import { StagePage } from './features/stage/StagePage'
import { NotebookPage } from './features/notebook/NotebookPage'
import { SettingsPage } from './features/settings/SettingsPage'

export function App() {
  return (
    <Routes>
      <Route path="/sets/:id/stage" element={<StagePage />} />
      <Route element={<AppShell />}>
        <Route path="/" element={<LibraryPage />} />
        <Route path="/jokes/:id" element={<JokeEditorPage />} />
        <Route path="/sets" element={<SetListPage />} />
        <Route path="/sets/:id" element={<SetBuilderPage />} />
        <Route path="/notebook" element={<NotebookPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  )
}
