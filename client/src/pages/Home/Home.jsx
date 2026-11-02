import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Gamepad2, Plus, Users, Check, Play } from 'lucide-react';
import GameCard from '../../components/games/GameCard.jsx';
import { getFriends, getServerHealth, getUserGameLibrary } from '../../services/api.js';
import { useAuth } from '../../context/AuthContext.jsx';

const weekday = new Intl.DateTimeFormat('ru-RU', { weekday: 'long' }).format(new Date());

export default function Home() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [serverStatus, setServerStatus] = useState('Проверяем сервер...');
  const [dashboard, setDashboard] = useState(null);
  const [loadingDashboard, setLoadingDashboard] = useState(true);
  const [dashboardError, setDashboardError] = useState('');

  useEffect(() => {
    let active = true;
    getServerHealth()
      .then(() => { if (active) setServerStatus('Сервер подключён'); })
      .catch(() => { if (active) setServerStatus('Сервер недоступен'); });

    if (user?.username) {
      Promise.all([getUserGameLibrary(user.username), getFriends()])
        .then(([library, friends]) => {
          if (!active) return;
          setDashboard({ library, friends: friends.friends || [] });
          setDashboardError('');
        })
        .catch(error => {
          if (active) setDashboardError(error.message || 'Не удалось загрузить обзор');
        })
        .finally(() => { if (active) setLoadingDashboard(false); });
    } else {
      setLoadingDashboard(false);
    }

    return () => { active = false; };
  }, [user?.username]);

  const counts = dashboard?.library?.counts;
  const friends = dashboard?.friends || [];
  const onlineFriends = friends.filter(friend => friend.online).length;
  const recentEntries = dashboard?.library?.entries?.slice(0, 3) || [];

  return (
    <div className="home-page">
      <section className="welcome-row">
        <div>
          <div className="eyebrow">{weekday.toLocaleUpperCase('ru-RU')}, ВРЕМЯ ИГРАТЬ</div>
          <h1>С возвращением, {user?.username || 'игрок'} <span>👋</span></h1>
          <p>Твоя игровая жизнь — в одном месте.</p>
        </div>
        <button className="primary-button" onClick={() => navigate('/library?tab=catalog')}>
          <Plus size={18} /> Добавить игру
        </button>
      </section>

      <section className="hero-banner">
        <div className="hero-copy">
          <span className="hero-tag">ТВОЙ ИГРОВОЙ ПРОФИЛЬ</span>
          <h2>Играй. Исследуй.<br />Достигай большего.</h2>
          <p>Собирай любимые игры, отмечай свой прогресс и находи компанию среди друзей.</p>
          <button className="hero-button" onClick={() => navigate('/library')}>
            Моя библиотека <ArrowRight size={17} />
          </button>
        </div>
        <div className="hero-orbit orbit-one" />
        <div className="hero-orbit orbit-two" />
        <div className="hero-controller"><Gamepad2 size={112} strokeWidth={1.1} /></div>
      </section>

      <section className="stats-grid" aria-label="Моя игровая статистика">
        <div className="stat-card">
          <div className="stat-icon purple"><Gamepad2 size={20} /></div>
          <div><span>Игр в библиотеке</span><strong>{loadingDashboard || dashboardError ? '—' : counts?.total ?? 0}</strong><small>В коллекции</small></div>
        </div>
        <div className="stat-card">
          <div className="stat-icon orange"><Play size={20} /></div>
          <div><span>Играю сейчас</span><strong>{loadingDashboard || dashboardError ? '—' : counts?.PLAYING ?? 0}</strong><small>Активные игры</small></div>
        </div>
        <div className="stat-card">
          <div className="stat-icon blue"><Check size={20} /></div>
          <div><span>Пройдено</span><strong>{loadingDashboard || dashboardError ? '—' : counts?.COMPLETED ?? 0}</strong><small>В моей библиотеке</small></div>
        </div>
        <div className="stat-card">
          <div className="stat-icon green"><Users size={20} /></div>
          <div><span>Друзья</span><strong>{loadingDashboard || dashboardError ? '—' : friends.length}</strong><small>{loadingDashboard ? 'Загружаем...' : dashboardError ? 'Недоступны' : `${onlineFriends} в сети`}</small></div>
        </div>
      </section>

      <section className="section-heading">
        <div><h2>Моя библиотека</h2><p>Последние добавленные или обновлённые игры</p></div>
        <button className="text-button" onClick={() => navigate('/library')}>
          Вся библиотека <ArrowRight size={16} />
        </button>
      </section>

      {dashboardError && <p className="home-data-error" role="alert">{dashboardError}</p>}
      {loadingDashboard ? <div className="home-data-state">Загружаем библиотеку и список друзей...</div>
        : dashboardError ? <div className="home-data-state">Не удалось загрузить библиотеку. Обнови страницу, чтобы попробовать снова.</div>
        : recentEntries.length ? (
          <section className="games-grid" aria-label="Игры в моей библиотеке">
            {recentEntries.map(entry => <GameCard key={entry.id} game={entry.game} status={entry.status} />)}
          </section>
        ) : (
          <section className="home-library-empty">
            <Gamepad2 size={28} />
            <strong>Библиотека пока пуста</strong>
            <span>Найди игру в каталоге и выбери, во что играешь или что хочешь пройти.</span>
            <button className="primary-button" onClick={() => navigate('/library?tab=catalog')}>
              Открыть каталог <ArrowRight size={15} />
            </button>
          </section>
        )}

      <footer className="home-footer">
        <span>GameHub © 2026</span>
        <span className="server-indicator"><i className={serverStatus === 'Сервер подключён' ? 'online' : ''} />{serverStatus}</span>
      </footer>
    </div>
  );
}
