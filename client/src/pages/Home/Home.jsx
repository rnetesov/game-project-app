import { ArrowRight, Gamepad2, Plus, TrendingUp, Users, Trophy } from 'lucide-react';
import GameCard from '../../components/games/GameCard.jsx';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getServerHealth, getUserGameLibrary } from '../../services/api.js';
import { useAuth } from '../../context/AuthContext.jsx';

const games = [
  { title: 'Cyberpunk 2077', subtitle: 'Night City awaits', category: 'RPG · OPEN WORLD', hours: 42, symbol: '2077', background: 'linear-gradient(135deg,#f5b65c,#d66c65 55%,#443b70)' },
  { title: 'DOOM Eternal', subtitle: 'Rip and tear', category: 'ACTION · FPS', hours: 18, symbol: 'DOOM', background: 'linear-gradient(135deg,#e58a5e,#a83c3c 58%,#492e35)' },
  { title: 'Forza Horizon 5', subtitle: 'Explore Mexico', category: 'RACING', hours: 26, symbol: 'FH5', background: 'linear-gradient(135deg,#77c9c0,#4b8c9b 55%,#344e72)' },
];

export default function Home() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [serverStatus, setServerStatus] = useState('Проверяем сервер...');
  const [libraryCount, setLibraryCount] = useState(0);
  useEffect(() => {
    getServerHealth().then(() => setServerStatus('Сервер подключён')).catch(() => setServerStatus('Сервер недоступен'));
    if (user?.username) {
      getUserGameLibrary(user.username)
        .then(result => setLibraryCount(result.counts?.total || 0))
        .catch(() => {});
    }
  }, [user?.username]);

  return (
    <div className="home-page">
      <section className="welcome-row"><div><div className="eyebrow">ПОНЕДЕЛЬНИК, ВРЕМЯ ИГРАТЬ</div><h1>С возвращением, {user?.username || 'игрок'} <span>👋</span></h1><p>Твоя игровая жизнь — в одном месте.</p></div><button className="primary-button" onClick={() => navigate('/library')}><Plus size={18} /> Добавить игру</button></section>
      <section className="hero-banner"><div className="hero-copy"><span className="hero-tag">ТВОЙ ИГРОВОЙ ПРОФИЛЬ</span><h2>Играй. Исследуй.<br />Достигай большего.</h2><p>Собирай любимые игры, следи за прогрессом и делись достижениями с друзьями.</p><button className="hero-button" onClick={() => navigate('/library')}>Моя библиотека <ArrowRight size={17} /></button></div><div className="hero-orbit orbit-one"/><div className="hero-orbit orbit-two"/><div className="hero-controller"><Gamepad2 size={112} strokeWidth={1.1} /></div></section>
      <section className="stats-grid">
        <div className="stat-card"><div className="stat-icon purple"><Gamepad2 size={20}/></div><div><span>Игр в библиотеке</span><strong>{libraryCount}</strong><small>Твоя коллекция</small></div></div>
        <div className="stat-card"><div className="stat-icon orange"><TrendingUp size={20}/></div><div><span>Всего наиграно</span><strong>86 <small>ч</small></strong><small>За всё время</small></div></div>
        <div className="stat-card"><div className="stat-icon green"><Users size={20}/></div><div><span>Друзья</span><strong>8</strong><small>2 сейчас в сети</small></div></div>
        <div className="stat-card"><div className="stat-icon blue"><Trophy size={20}/></div><div><span>Достижения</span><strong>34</strong><small>Получено всего</small></div></div>
      </section>
      <section className="section-heading"><div><h2>Недавно в игре</h2><p>Продолжай с того места, где остановился</p></div><button className="text-button" onClick={() => navigate('/library')}>Вся библиотека <ArrowRight size={16}/></button></section>
      <section className="games-grid">{games.map(game => <GameCard key={game.title} game={game}/>)}</section>
      <footer className="home-footer"><span>GameHub © 2026</span><span className="server-indicator"><i className={serverStatus === 'Сервер подключён' ? 'online' : ''}/>{serverStatus}</span></footer>
    </div>
  );
}
