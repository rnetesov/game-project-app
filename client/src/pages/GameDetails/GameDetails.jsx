import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, CalendarDays, Gamepad2, Monitor, Tags, Trash2, UserRound } from 'lucide-react';
import { getAssetUrl, getGameBySlug, removeGameFromLibrary, setGameLibraryStatus } from '../../services/api.js';

const STATUS_OPTIONS = [
  { value: 'PLAYING', label: 'Играю сейчас' },
  { value: 'WANT_TO_PLAY', label: 'Хочу пройти' },
  { value: 'COMPLETED', label: 'Пройдено' },
];

export default function GameDetails() {
  const { slug } = useParams();
  const [game, setGame] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    getGameBySlug(slug)
      .then(result => { if (!cancelled) setGame(result.game); })
      .catch(err => { if (!cancelled) setError(err.message || 'Не удалось загрузить игру'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [slug]);

  async function changeStatus(event) {
    const status = event.target.value;
    if (!status || !game || busy) return;
    setBusy(true);
    setError('');
    try {
      const result = await setGameLibraryStatus(game.id, status);
      setGame(current => ({ ...current, libraryStatus: result.entry.status }));
    } catch (err) {
      setError(err.message || 'Не удалось изменить статус игры');
    } finally {
      setBusy(false);
    }
  }

  async function removeFromLibrary() {
    if (!game || busy) return;
    setBusy(true);
    setError('');
    try {
      await removeGameFromLibrary(game.id);
      setGame(current => ({ ...current, libraryStatus: null }));
    } catch (err) {
      setError(err.message || 'Не удалось убрать игру из библиотеки');
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <div className="game-details-state">Загружаем страницу игры...</div>;
  if (!game) return <div className="game-details-state"><strong>{error || 'Игра не найдена'}</strong><Link to="/library">Вернуться в библиотеку</Link></div>;

  const genre = [game.genre, game.subGenre].filter(Boolean).join(' · ');
  const statusLabel = STATUS_OPTIONS.find(option => option.value === game.libraryStatus)?.label;

  return (
    <div className="game-details-page">
      <Link className="game-back-link" to="/library?tab=catalog"><ArrowLeft size={16} /> Каталог игр</Link>
      <section className="game-details-hero">
        <div className="game-details-cover">
          <div className="game-details-cover-fallback"><Gamepad2 size={62} /></div>
          {game.coverUrl && <img src={getAssetUrl(game.coverUrl)} alt={'Обложка ' + game.title} onError={event => { event.currentTarget.style.display = 'none'; }} />}
        </div>
        <div className="game-details-copy">
          <span className="game-details-eyebrow">ИГРА ИЗ КАТАЛОГА</span>
          <h1>{game.title}</h1>
          <div className="game-details-facts">
            {genre && <span><Tags size={15} />{genre}</span>}
            {game.releaseYear && <span><CalendarDays size={15} />{game.releaseYear}</span>}
            {game.platforms && <span><Monitor size={15} />{game.platforms}</span>}
          </div>
          <p>{game.description || 'Для этой игры пока не добавили описание.'}</p>
          <div className="game-details-actions">
            <label className="game-status-control">
              <span>{statusLabel ? 'Статус в библиотеке' : 'Добавить в библиотеку'}</span>
              <select value={game.libraryStatus || ''} onChange={changeStatus} disabled={busy} aria-label="Статус игры в библиотеке">
                <option value="" disabled>{statusLabel || 'Выбери статус'}</option>
                {STATUS_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>
            {game.libraryStatus && <button type="button" className="game-remove-button" onClick={removeFromLibrary} disabled={busy}><Trash2 size={16} /> Убрать</button>}
          </div>
          {error && <p className="game-details-error" role="alert">{error}</p>}
        </div>
      </section>
      <section className="game-details-info">
        <div><span>Жанр</span><strong>{genre || 'Не указан'}</strong></div>
        <div><span>Платформы</span><strong>{game.platforms || 'Не указаны'}</strong></div>
        <div><span>Добавил в каталог</span><strong>{game.createdBy?.username ? <><UserRound size={14} /> @{game.createdBy.username}</> : 'GameHub'}</strong></div>
      </section>
    </div>
  );
}
