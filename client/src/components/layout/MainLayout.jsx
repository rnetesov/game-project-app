import { Bell, Search, LogOut } from 'lucide-react';
import { useEffect } from 'react';
import { sendHeartbeat } from '../../services/api.js';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar.jsx';
import { useAuth } from '../../context/AuthContext.jsx';

export default function MainLayout() {
  const { user, logout } = useAuth();
  const initial = user?.username?.charAt(0)?.toUpperCase() || 'G';

  useEffect(() => {
    if (!user) return;
    sendHeartbeat().catch(() => {});
    const timer = setInterval(() => sendHeartbeat().catch(() => {}), 30000);
    return () => clearInterval(timer);
  }, [user?.id]);

  return (
    <div className="app-shell">
      <Sidebar />
      <main className="main-area">
        <header className="topbar">
          <div className="breadcrumb">Игровая платформа <span>/</span> <strong>Обзор</strong></div>
          <div className="topbar-actions">
            <label className="search-box"><Search size={17} /><input placeholder="Найти игру..." /></label>
            <button className="icon-button" aria-label="Уведомления"><Bell size={19} /></button>
            <div className="avatar avatar-small">{initial}</div>
            <button className="icon-button" aria-label="Выйти" title="Выйти" onClick={logout}><LogOut size={18}/></button>
          </div>
        </header>
        <div className="page-content"><Outlet /></div>
      </main>
    </div>
  );
}
