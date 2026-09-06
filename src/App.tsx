import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AppFooter } from './components/AppFooter'
import { ChecklistPage } from './pages/ChecklistPage'
import { CreateListPage } from './pages/CreateListPage'
import { EditListPage } from './pages/EditListPage'
import { HomePage } from './pages/HomePage'

export default function App() {
  return (
    <BrowserRouter>
      <div className="app-shell">
        <div className="app-content">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/nueva" element={<CreateListPage />} />
            <Route path="/lista/:id" element={<ChecklistPage />} />
            <Route path="/lista/:id/editar" element={<EditListPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
        <AppFooter />
      </div>
    </BrowserRouter>
  )
}
