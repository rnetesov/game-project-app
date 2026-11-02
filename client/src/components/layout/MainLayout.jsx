import { Bell, Search, LogOut, CheckCheck } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import {
  getNotifications, markAllNotificationsRead, markNotificationRead, sendHeartbeat,
} from '../../services/api.js';
import Sidebar from './Sidebar.jsx';
import { useAuth } from '../../context/AuthContext.jsx';

function notificationText(type) {
  switch (type) {
    case 'COMMENT': return 'прокомментировал вашу публикацию';
    case 'LIKE': return 'отметил вашу публикацию';
    case 'FRIEND_REQUEST': return 'отправил заявку в друзья';
    case 'FRIEND_ACCEPTED': return 'принял вашу заявку в друзья';
    default: return 'оставил новое уведомление';
  }
}

function notificationTarget(type) {
  return type === 'FRIEND_REQUEST' || type === 'FRIEND_ACCEPTED' ? '/friends' : '/feed';
}

function formatNotificationDate(value) {
  return new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  }).format(new Date(value));
}

export default function MainLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const initial = user?.username?.charAt(0)?.toUpperCase() || 'G';
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [notificationsError, setNotificationsError] = useState('');

  const loadNotifications = useCallback(async () => {
    try {
      const data = await getNotifications();
      setNotifications(data.notifications || []);
      setUnreadCount(data.unreadCount || 0);
      setNotificationsError('');
    } catch {
      // Keep the rest of the app usable when the notification request briefly fails.
    }
  }, []);

  useEffect(() => {
    if (!user?.id) return;
    sendHeartbeat().catch(() => {});
    loadNotifications();
    const heartbeatTimer = setInterval(() => sendHeartbeat().catch(() => {}), 30000);
    const notificationsTimer = setInterval(loadNotifications, 15000);
    return () => {
      clearInterval(heartbeatTimer);
      clearInterval(notificationsTimer);
    };
  }, [user?.id, loadNotifications]);

  async function openNotification(notification) {
    setNotificationsOpen(false);
    try {
      if (!notification.readAt) {
        await markNotificationRead(notification.id);
        setNotifications(current => current.map(item => item.id === notification.id
          ? { ...item, readAt: new Date().toISOString() }
          : item));
        setUnreadCount(current => Math.max(0, current - 1));
      }
    } catch {
      setNotificationsError('Не удалось отметить уведомление прочитанным');
    }
    navigate(notificationTarget(notification.type));
  }

  async function markAllRead() {
    setNotificationsLoading(true);
    setNotificationsError('');
    try {
      await markAllNotificationsRead();
      const now = new Date().toISOString();
      setNotifications(current => current.map(item => ({ ...item, readAt: item.readAt || now })));
      setUnreadCount(0);
    } catch {
      setNotificationsError('Не удалось обновить уведомления');
    } finally {
      setNotificationsLoading(false);
    }
  }

  return (
    <div className="app-shell">
      <Sidebar />
      <main className="main-area">
        <header className="topbar">
          <div className="breadcrumb">Игровая платформа <span>/</span> <strong>Обзор</strong></div>
          <div className="topbar-actions">
            <label className="search-box"><Search size={17} /><input placeholder="Найти игру..." /></label>
            <div className="notification-anchor">
              <button
                className="icon-button notification-trigger"
                aria-label={`Уведомления: ${unreadCount} непрочитанных`}
                aria-expanded={notificationsOpen}
                onClick={() => { setNotificationsOpen(open => !open); setNotificationsError(''); }}
              >
                <Bell size={19} />
                {unreadCount > 0 && <span className="notification-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>}
              </button>
              {notificationsOpen && <section className="notification-panel" aria-label="Уведомления">
                <div className="notification-panel-head">
                  <div><strong>Уведомления</strong><small>{unreadCount ? `Непрочитанных: ${unreadCount}` : 'Всё просмотрено'}</small></div>
                  {unreadCount > 0 && <button onClick={markAllRead} disabled={notificationsLoading}><CheckCheck size={14} />Прочитать все</button>}
                </div>
                {notificationsError && <p className="notification-error">{notificationsError}</p>}
                {notifications.length === 0
                  ? <div className="notification-empty"><Bell size={22} /><strong>Пока тихо</strong><span>Новые реакции и заявки появятся здесь</span></div>
                  : <div className="notification-list">
                    {notifications.map(notification => <button
                      key={notification.id}
                      className={`notification-item${notification.readAt ? '' : ' unread'}`}
                      onClick={() => openNotification(notification)}
                    >
                      {notification.actor.avatarUrl
                        ? <img src={notification.actor.avatarUrl} alt="" />
                        : <span className="notification-avatar-fallback">{notification.actor.username?.[0]?.toUpperCase() || '?'}</span>}
                      <span className="notification-copy">
                        <span><strong>{notification.actor.username}</strong> {notificationText(notification.type)}</span>
                        <time>{formatNotificationDate(notification.createdAt)}</time>
                      </span>
                      {!notification.readAt && <i aria-label="Непрочитано" />}
                    </button>)}
                  </div>}
                <div className="notification-panel-foot">Обновляется автоматически каждые 15 секунд</div>
              </section>}
            </div>
            <div className="avatar avatar-small">{initial}</div>
            <button className="icon-button" aria-label="Выйти" title="Выйти" onClick={logout}><LogOut size={18}/></button>
          </div>
        </header>
        <div className="page-content"><Outlet /></div>
      </main>
    </div>
  );
}
