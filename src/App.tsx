import { Route, Routes } from 'react-router-dom'
import { Layout } from './ui/Layout/Layout'
import { NotFoundPage } from './features/NotFoundPage'
import { LibraryPage } from './features/library/LibraryPage'
import { JokeEditorPage } from './features/joke/JokeEditorPage'
import { SetsPage } from './features/sets/SetsPage'
import { SetBuilderPage } from './features/sets/SetBuilderPage'
import { StagePage } from './features/stage/StagePage'
import { NotebookPage } from './features/notebook/NotebookPage'
import { SettingsPage } from './features/settings/SettingsPage'

export function App() {
  return (
    <Routes>
      <Route path="/sets/:id/stage" element={<StagePage />} />
      <Route element={<Layout />}>
        <Route path="/" element={<LibraryPage />} />
        <Route path="/jokes/:id" element={<JokeEditorPage />} />
        <Route path="/sets" element={<SetsPage />} />
        <Route path="/sets/:id" element={<SetBuilderPage />} />
        <Route path="/notebook" element={<NotebookPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  )
}
