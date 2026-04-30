import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Chat from './pages/Chat';
import Patients from './pages/Patients';
import Settings from './pages/Settings';
import PrivacyPolicy from './pages/PrivacyPolicy';
import TermsOfService from './pages/TermsOfService';
import Layout from './components/Layout';
import Team from './pages/Team';
import Reports from './pages/Reports';

function App() {
  const { isAuthenticated } = useAuthStore();

  return (
    <Routes>
      {/* Públicas */}
      <Route path="/privacy" element={<PrivacyPolicy />} />
      <Route path="/terms" element={<TermsOfService />} />
      
      <Route
        path="/login"
        element={isAuthenticated ? <Navigate to="/" /> : <Login />}
      />
      <Route
        path="/"
        element={isAuthenticated ? <Layout /> : <Navigate to="/login" />}
      >
        <Route index element={<Dashboard />} />
        <Route path="chats" element={<Chat />} />
        <Route path="chats/:chatId" element={<Chat />} />
        <Route path="patients" element={<Patients />} />
        <Route path="team" element={<Team />} />
        <Route path="reports" element={<Reports />} />
        <Route path="settings" element={<Settings />} />
      </Route>
    </Routes>
  );
}

export default App;
