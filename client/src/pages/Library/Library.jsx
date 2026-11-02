import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Gamepad2, Library, Search, Plus, Check, Trash2, X, RefreshCw, Tags } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import {
  getGames,
  addGameToCatalog,
  getUserGameLibrary,
  setGameLibraryStatus,
  removeGameFromLibrary,
} from '../../services/api.js';
import './Library.css';

const STATUS_OPTIONS = [
  { value: 'PLAYING', label: 'Играю сейчас' },
  { value: 'WANT_TO_PLAY', label: 'Хочу пройти' },
  { value: 'COMPLETED', label: 'Пройдено' },
];

const STATUS_LABELS = {
  PLAYING: 'Играю сейчас',
  WANT_TO_PLAY: 'Хочу пройти',
  COMPLETED: 'Пройдено',
};

const GENRES = [
  { value: 'RPG', label: 'RPG' },
  { value: 'Action', label: 'Экшен' },
  { value: 'Shooter', label: 'Шутеры' },
  { value: 'Racing', label: 'Гонки' },
  { value: 'Roguelike', label: 'Рогалики' },
  { value: 'Metroidvania', label: 'Метроидвании' },
  { value: 'Simulator', label: 'Симуляторы' },
  { value: 'Puzzle', label: 'Головоломки' },
  { value: 'Sandbox', label: 'Песочницы' },
  { value: 'Adventure', label: 'Приключения' },
  { value: 'Horror', label: 'Хоррор' },
];

function genreLabel(value) {
  return GENRES.find(genre => genre.value === value)?.label || value;
}

function GenreFilters({ value, onChange }) {
  return (
    <div className="library-genre-filters" role="group" aria-label="Фильтр по жанрам">
      <button type="button" className={value === 'ALL' ? 'active' : ''} aria-pressed={value === 'ALL'} onClick={() => onChange('ALL')}>Все жанры</button>
      {GENRES.map(genre => (
        <button
          type="button"
          key={genre.value}
          className={value === genre.value ? 'active' : ''}
          aria-pressed={value === genre.value}
          onClick={() => onChange(genre.value)}
        >
          {genre.label}
        </button>
      ))}
    </div>
  );
}

function GameCover({ game }) {
  return (
    <div className="library-game-cover">
      <div className="library-cover-fallback"><Gamepad2 size={34} /><span>{game.title}</span></div>
      {game.coverUrl && (
        <img
          src={game.coverUrl}
          alt={'Обложка ' + game.title}
          loading="lazy"
          onError={event => { event.currentTarget.style.display = 'none'; }}
        />
      )}
      {game.releaseYear && <span className="library-cover-year">{game.releaseYear}</span>}
    </div>
  );
}

function GameTile({ game, status, readOnly, busy, onStatusChange, onRemove, catalog = false }) {
  return (
    <article className="library-game-card">
      <GameCover game={game} />
      <div className="library-game-card-body">
        <div className="library-game-title-row">
          <h3>{game.title}</h3>
          {status && <span className={'library-status-dot status-' + status.toLowerCase()} />}
        </div>
        <p className="library-game-genre">{genreLabel(game.genre)}{game.subGenre ? ' · ' + game.subGenre : ''}</p>
        {catalog && game.createdBy?.username && <p className="library-game-added-by">Добавил @{game.createdBy.username}</p>}
        <p className="library-game-platforms">{game.platforms}</p>
        {readOnly ? (
          <span className={'library-status-label status-' + (status || '').toLowerCase()}>{STATUS_LABELS[status] || 'В библиотеке'}</span>
        ) : (
          <div className="library-game-controls">
            <label className="library-status-select-label">
              <span>{catalog && !status ? 'Добавить со статусом' : 'Статус'}</span>
              <select
                value={status || ''}
                disabled={busy}
                onChange={event => onStatusChange(game.id, event.target.value)}
                aria-label={'Статус игры ' + game.title}
              >
                <option value="" disabled>Выбери статус</option>
                {STATUS_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>
            {status && (
              <button
                type="button"
                className="library-remove-button"
                onClick={() => onRemove(game.id)}
                disabled={busy}
                title="Убрать из библиотеки"
                aria-label={'Убрать ' + game.title + ' из библиотеки'}
              >
                <Trash2 size={15} />
              </button>
            )}
          </div>
        )}
      </div>
    </article>
  );
}

export default function LibraryPage() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const viewedUsername = searchParams.get('user') || user?.username;
  const isOwnLibrary = viewedUsername === user?.username;
  const [activeTab, setActiveTab] = useState('library');
  const [activeStatus, setActiveStatus] = useState('ALL');
  const [activeGenre, setActiveGenre] = useState('ALL');
  const [entries, setEntries] = useState([]);
  const [counts, setCounts] = useState({ total: 0, PLAYING: 0, WANT_TO_PLAY: 0, COMPLETED: 0 });
  const [games, setGames] = useState([]);
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [profileUser, setProfileUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busyGames, setBusyGames] = useState({});
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showAddGame, setShowAddGame] = useState(false);
  const [submittingGame, setSubmittingGame] = useState(false);
  const [gameDraft, setGameDraft] = useState({ title: '', genre: 'RPG', subGenre: '', platforms: 'PC', releaseYear: '' });

  const refreshLibrary = useCallback(async () => {
    const result = await getUserGameLibrary(viewedUsername);
    setProfileUser(result.user);
    setEntries(result.entries || []);
    setCounts(result.counts || { total: 0, PLAYING: 0, WANT_TO_PLAY: 0, COMPLETED: 0 });
  }, [viewedUsername]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    Promise.all([
      getUserGameLibrary(viewedUsername),
      isOwnLibrary ? getGames('', '') : Promise.resolve({ games: [] }),
    ]).then(([library, catalog]) => {
      if (cancelled) return;
      setProfileUser(library.user);
      setEntries(library.entries || []);
      setCounts(library.counts || { total: 0, PLAYING: 0, WANT_TO_PLAY: 0, COMPLETED: 0 });
      setGames(catalog.games || []);
    }).catch(err => {
      if (!cancelled) setError(err.message || 'Не удалось загрузить библиотеку');
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [viewedUsername, isOwnLibrary]);

  const visibleEntries = useMemo(() => entries.filter(entry =>
    (activeStatus === 'ALL' || entry.status === activeStatus)
    && (activeGenre === 'ALL' || entry.game.genre === activeGenre)
  ), [entries, activeStatus, activeGenre]);

  const submitSearch = async event => {
    event.preventDefault();
    setSearchQuery(searchInput.trim());
    setLoading(true);
    setError('');
    try {
      const result = await getGames(searchInput.trim(), activeGenre === 'ALL' ? '' : activeGenre);
      setGames(result.games || []);
    } catch (err) {
      setError(err.message || 'Не удалось выполнить поиск');
    } finally {
      setLoading(false);
    }
  };

  const clearSearch = async () => {
    setSearchInput('');
    setSearchQuery('');
    setLoading(true);
    try {
      const result = await getGames('', activeGenre === 'ALL' ? '' : activeGenre);
      setGames(result.games || []);
    } catch (err) {
      setError(err.message || 'Не удалось загрузить каталог');
    } finally {
      setLoading(false);
    }
  };

  async function changeCatalogGenre(genre) {
    setActiveGenre(genre);
    setLoading(true);
    setError('');
    try {
      const result = await getGames(searchQuery, genre === 'ALL' ? '' : genre);
      setGames(result.games || []);
    } catch (err) {
      setError(err.message || 'Не удалось отфильтровать каталог');
    } finally {
      setLoading(false);
    }
  }

  async function submitNewGame(event) {
    event.preventDefault();
    if (submittingGame) return;
    setSubmittingGame(true);
    setError('');
    setSuccess('');
    try {
      const result = await addGameToCatalog({
        title: gameDraft.title.trim(),
        genre: gameDraft.genre,
        subGenre: gameDraft.subGenre.trim(),
        platforms: gameDraft.platforms.trim(),
        releaseYear: gameDraft.releaseYear ? Number(gameDraft.releaseYear) : null,
      });
      setGameDraft({ title: '', genre: 'RPG', subGenre: '', platforms: 'PC', releaseYear: '' });
      setShowAddGame(false);
      setActiveGenre(result.game.genre);
      setSearchInput('');
      setSearchQuery('');
      const catalog = await getGames('', result.game.genre);
      setGames(catalog.games || []);
      setSuccess('Игра добавлена в общий каталог и теперь доступна всем участникам GameHub.');
    } catch (err) {
      setError(err.message || 'Не удалось добавить игру в каталог');
    } finally {
      setSubmittingGame(false);
    }
  }

  async function changeStatus(gameId, status) {
    if (!status) return;
    setBusyGames(current => ({ ...current, [gameId]: true }));
    setError('');
    try {
      const result = await setGameLibraryStatus(gameId, status);
      setEntries(current => {
        const next = current.filter(entry => entry.game.id !== gameId);
        return [result.entry, ...next];
      });
      setGames(current => current.map(game => game.id === gameId
        ? { ...game, libraryStatus: result.entry.status }
        : game));
      await refreshLibrary();
    } catch (err) {
      setError(err.message || 'Не удалось обновить библиотеку');
    } finally {
      setBusyGames(current => ({ ...current, [gameId]: false }));
    }
  }

  async function removeGame(gameId) {
    setBusyGames(current => ({ ...current, [gameId]: true }));
    setError('');
    try {
      await removeGameFromLibrary(gameId);
      setEntries(current => current.filter(entry => entry.game.id !== gameId));
      setGames(current => current.map(game => game.id === gameId ? { ...game, libraryStatus: null } : game));
      await refreshLibrary();
    } catch (err) {
      setError(err.message || 'Не удалось убрать игру из библиотеки');
    } finally {
      setBusyGames(current => ({ ...current, [gameId]: false }));
    }
  }

  return (
    <main className="page-content library-page">
      <div className="welcome-row">
        <div>
          <div className="eyebrow">ТВОЯ ИГРОВАЯ КОЛЛЕКЦИЯ</div>
          <h1>{isOwnLibrary ? 'Моя библиотека' : 'Библиотека игрока'}</h1>
          <p>{isOwnLibrary ? 'Собирай игры и отмечай свой игровой прогресс.' : 'Игровая коллекция пользователя ' + (profileUser?.username || viewedUsername) + '.'}</p>
        </div>
        <div className="library-title-icon"><Library size={22} /></div>
      </div>

      <section className="library-summary">
        <div className="library-summary-main">
          <span>ВСЕГО ИГР</span>
          <strong>{counts.total}</strong>
          <small>{profileUser?.username || user?.username}</small>
        </div>
        <div className="library-summary-stat"><span className="library-summary-icon playing"><Gamepad2 size={17} /></span><div><strong>{counts.PLAYING}</strong><small>Играю сейчас</small></div></div>
        <div className="library-summary-stat"><span className="library-summary-icon wishlist"><Plus size={17} /></span><div><strong>{counts.WANT_TO_PLAY}</strong><small>Хочу пройти</small></div></div>
        <div className="library-summary-stat"><span className="library-summary-icon completed"><Check size={17} /></span><div><strong>{counts.COMPLETED}</strong><small>Пройдено</small></div></div>
      </section>

      {error && <div className="library-error">{error}</div>}
      {success && <div className="library-success">{success}</div>}

      {isOwnLibrary && (
        <div className="library-main-tabs" role="tablist" aria-label="Раздел библиотеки">
          <button type="button" role="tab" aria-selected={activeTab === 'library'} className={activeTab === 'library' ? 'active' : ''} onClick={() => setActiveTab('library')}>
            <Library size={15} /> Моя коллекция <span>{counts.total}</span>
          </button>
          <button type="button" role="tab" aria-selected={activeTab === 'catalog'} className={activeTab === 'catalog' ? 'active' : ''} onClick={() => setActiveTab('catalog')}>
            <Search size={15} /> Каталог игр
          </button>
        </div>
      )}

      {(!isOwnLibrary || activeTab === 'library') && (
        <>
          <div className="library-status-tabs" role="group" aria-label="Фильтр игр">
            {[
              ['ALL', 'Все игры', counts.total],
              ['PLAYING', 'Играю', counts.PLAYING],
              ['WANT_TO_PLAY', 'Хочу пройти', counts.WANT_TO_PLAY],
              ['COMPLETED', 'Пройдено', counts.COMPLETED],
            ].map(([value, label, count]) => (
              <button key={value} type="button" className={activeStatus === value ? 'active' : ''} aria-pressed={activeStatus === value} onClick={() => setActiveStatus(value)}>
                {label}<span>{count}</span>
              </button>
            ))}
          </div>
          <GenreFilters value={activeGenre} onChange={setActiveGenre} />
          {loading ? <div className="library-state">Загружаем библиотеку...</div> : visibleEntries.length === 0 ? (
            <div className="library-empty">
              <Gamepad2 size={30} />
              <strong>{activeStatus === 'ALL' ? 'Библиотека пока пуста' : 'В этой категории пока нет игр'}</strong>
              <span>{isOwnLibrary ? 'Открой каталог и добавь первую игру в свою коллекцию.' : 'Пользователь пока не добавил сюда игры.'}</span>
              {isOwnLibrary && <button type="button" className="primary-button" onClick={() => setActiveTab('catalog')}>Открыть каталог</button>}
            </div>
          ) : (
            <div className="library-game-grid">
              {visibleEntries.map(entry => (
                <GameTile
                  key={entry.id}
                  game={entry.game}
                  status={entry.status}
                  readOnly={!isOwnLibrary}
                  busy={busyGames[entry.game.id]}
                  onStatusChange={changeStatus}
                  onRemove={removeGame}
                />
              ))}
            </div>
          )}
        </>
      )}

      {isOwnLibrary && activeTab === 'catalog' && (
        <section className="library-catalog">
          <div className="library-section-heading">
            <div><h2>Каталог игр</h2><p>Найди игру, добавь её себе или предложи сообществу новую.</p></div>
            <div className="library-catalog-heading-actions">
              <span>{games.length} игр</span>
              <button type="button" className="library-add-game-trigger" onClick={() => { setShowAddGame(open => !open); setError(''); }}>
                {showAddGame ? <X size={14} /> : <Plus size={14} />} {showAddGame ? 'Закрыть' : 'Предложить игру'}
              </button>
            </div>
          </div>
          {showAddGame && (
            <form className="library-add-game-form" onSubmit={submitNewGame}>
              <div className="library-add-game-form-heading">
                <div><strong>Добавить игру в общий каталог</strong><span>После добавления она станет доступна всем пользователям.</span></div>
                <Tags size={18} />
              </div>
              <div className="library-add-game-fields">
                <label>Название игры
                  <input value={gameDraft.title} onChange={event => setGameDraft(current => ({ ...current, title: event.target.value }))} minLength={2} maxLength={80} required placeholder="Например, Alan Wake 2" />
                </label>
                <label>Основной жанр
                  <select value={gameDraft.genre} onChange={event => setGameDraft(current => ({ ...current, genre: event.target.value }))}>
                    {GENRES.map(genre => <option key={genre.value} value={genre.value}>{genre.label}</option>)}
                  </select>
                </label>
                <label>Поджанр <span className="library-field-optional">необязательно</span>
                  <input value={gameDraft.subGenre} onChange={event => setGameDraft(current => ({ ...current, subGenre: event.target.value }))} maxLength={40} placeholder="Например, Open world" />
                </label>
                <label>Платформы
                  <input value={gameDraft.platforms} onChange={event => setGameDraft(current => ({ ...current, platforms: event.target.value }))} minLength={2} maxLength={120} required placeholder="PC, PlayStation, Xbox" />
                </label>
                <label>Год выпуска <span className="library-field-optional">необязательно</span>
                  <input type="number" min="1970" max={new Date().getFullYear() + 2} value={gameDraft.releaseYear} onChange={event => setGameDraft(current => ({ ...current, releaseYear: event.target.value }))} placeholder="2025" />
                </label>
              </div>
              <div className="library-add-game-footer">
                <span>Проверяем повторы. Лимит — 10 новых игр за 24 часа.</span>
                <button type="submit" className="primary-button" disabled={submittingGame || gameDraft.title.trim().length < 2 || gameDraft.platforms.trim().length < 2}>
                  <Plus size={15} /> {submittingGame ? 'Добавляем...' : 'Добавить в каталог'}
                </button>
              </div>
            </form>
          )}
          <form className="library-search" onSubmit={submitSearch}>
            <Search size={17} />
            <input
              type="search"
              value={searchInput}
              onChange={event => setSearchInput(event.target.value)}
              maxLength={100}
              placeholder="Название игры или жанр..."
              aria-label="Поиск по каталогу игр"
            />
            {searchInput && <button type="button" onClick={clearSearch} aria-label="Очистить поиск"><X size={15} /></button>}
            <button type="submit" disabled={searchInput.trim() === searchQuery}>Найти</button>
          </form>
          <GenreFilters value={activeGenre} onChange={changeCatalogGenre} />
          {loading ? <div className="library-state">Ищем игры...</div> : games.length === 0 ? (
            <div className="library-empty library-empty-compact"><Search size={25} /><strong>Игры не найдены</strong><span>Попробуй другое название или жанр.</span></div>
          ) : (
            <div className="library-game-grid">
              {games.map(game => (
                <GameTile
                  key={game.id}
                  game={game}
                  status={game.libraryStatus}
                  catalog
                  busy={busyGames[game.id]}
                  onStatusChange={changeStatus}
                  onRemove={removeGame}
                />
              ))}
            </div>
          )}
          <p className="library-catalog-note">Каждая новая игра становится общей для сообщества. Выбери жанр, чтобы быстро найти нужную категорию.</p>
        </section>
      )}
    </main>
  );
}
