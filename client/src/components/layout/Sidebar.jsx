import { Gamepad2, Home, Library, Trophy, Users, Settings, Newspaper } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
const links = [
  { to: '/', label: 'Главная', icon: Home },
  { to: '/library', label: 'Моя библиотека', icon: Library },
  { to: '/feed', label: 'Лента активности', icon: Newspaper },
  { to: '/friends', label: 'Друзья', icon: Users },
  { to: '/profile', label: 'Мой профиль', icon: Users },
  { to: '/achievements', label: 'Достижения', icon: Trophy },
];
export default function Sidebar() {
  const { user } = useAuth();
  const initial = user?.username?.charAt(0)?.toUpperCase() || 'G';
  return <aside className="sidebar">
    <NavLink to="/" className="brand"><span className="brand-mark"><Gamepad2 size={22} /></span><span>Game<span>Hub</span></span></NavLink>
    <div className="nav-caption">МЕНЮ</div>
    <nav className="nav-list">
      {links.map(({ to, label, icon: Icon }) => <NavLink key={to} to={to} end className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
        <Icon size={19} strokeWidth={1.8} /><span>{label}</span>
      </NavLink>)}
    </nav>
    <div className="sidebar-bottom">
      <div className="profile-mini"><div className="avatar">{initial}</div><div><strong>{user?.username || 'Игрок'}</strong><small>Игрок GameHub</small></div></div>
      <button className="settings-link"><Settings size={18} /> Настройки</button>
    </div>
  </aside>;
}
