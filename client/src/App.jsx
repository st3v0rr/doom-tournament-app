import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { useTranslation } from 'react-i18next';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Slots from './pages/Slots';
import Leaderboard from './pages/Leaderboard';
import Bracket from './pages/Bracket';
import Display from './pages/Display';
import AdminLogin from './pages/AdminLogin';
import Admin from './pages/Admin';
import Nav from './components/Nav';
import './App.css';

function PrivateRoute({ children, role }) {
  const { auth, loading } = useAuth();
  const { t } = useTranslation();
  if (loading) return <div className="loading">{t('common.loading')}</div>;
  if (!auth?.authenticated) return <Navigate to="/login" replace />;
  if (role && auth.role !== role) return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  const { auth, loading } = useAuth();
  const { t } = useTranslation();
  const location = useLocation();

  if (loading) return <div className="loading">{t('common.loading')}</div>;

  return (
    <>
      {auth?.authenticated && location.pathname !== '/display' && <Nav />}
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route path="/display" element={<Display />} />
        <Route path="/leaderboard" element={<Leaderboard />} />
        <Route path="/bracket" element={<Bracket />} />

        <Route
          path="/"
          element={
            auth?.authenticated ? (
              auth.role === 'admin' ? (
                <Navigate to="/admin" replace />
              ) : (
                <Dashboard />
              )
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />

        <Route
          path="/slots"
          element={
            <PrivateRoute>
              <Slots />
            </PrivateRoute>
          }
        />

        <Route
          path="/dashboard"
          element={
            <PrivateRoute>
              <Dashboard />
            </PrivateRoute>
          }
        />

        <Route
          path="/admin"
          element={
            <PrivateRoute role="admin">
              <Admin />
            </PrivateRoute>
          }
        />
      </Routes>
    </>
  );
}
