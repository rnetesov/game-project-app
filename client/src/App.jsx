import { Navigate, Route, Routes } from 'react-router-dom';
import MainLayout from './components/layout/MainLayout.jsx';
import Home from './pages/Home/Home.jsx';
import AuthPage from './pages/Auth/AuthPage.jsx';
import Profile from './pages/Profile/Profile.jsx';
import Friends from './pages/Friends/Friends.jsx';
import ActivityFeed from './pages/Feed/ActivityFeed.jsx';
import Messages from './pages/Messages/Messages.jsx';
import { useAuth } from './context/AuthContext.jsx';

function ProtectedLayout() {
  const { loading, isAuthenticated } = useAuth();
  if (loading) return <div className="app-loading">Загружаем GameHub...</div>;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <MainLayout />;
}

export default function App() {
  return <Routes>
    <Route path="/login" element={<AuthPage mode="login" />} />
    <Route path="/register" element={<AuthPage mode="register" />} />
    <Route element={<ProtectedLayout />}>
      <Route path="/" element={<Home />} />
      <Route path="/profile" element={<Profile />} />
      <Route path="/friends" element={<Friends />} />
      <Route path="/feed" element={<ActivityFeed />} />
      <Route path="/messages" element={<Messages />} />
    </Route>
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes>;
}
