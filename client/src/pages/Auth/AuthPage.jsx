import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { Gamepad2, Eye, EyeOff, ArrowRight, ShieldCheck } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';

export default function AuthPage({ mode = 'login' }) {
  const isRegister = mode === 'register';
  const { login, register, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ username: '', emailOrUsername: '', email: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (isAuthenticated) return <Navigate to="/" replace />;

  function update(event) {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      if (isRegister) {
        await register({ username: form.username, email: form.email, password: form.password });
      } else {
        await login({ emailOrUsername: form.emailOrUsername, password: form.password });
      }
      navigate('/', { replace: true });
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-card">
        <Link to="/" className="auth-brand"><span className="brand-mark"><Gamepad2 size={22} /></span>Game<span>Hub</span></Link>
        <div className="auth-heading">
          <span className="auth-kicker">ТВОЯ ИГРОВАЯ ВСЕЛЕННАЯ</span>
          <h1>{isRegister ? 'Создать аккаунт' : 'С возвращением!'}</h1>
          <p>{isRegister ? 'Присоединяйся к GameHub и собирай свою игровую историю.' : 'Войди, чтобы продолжить свою игровую историю.'}</p>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          {isRegister && <label>Никнейм<input name="username" value={form.username} onChange={update} placeholder="Например, PlayerOne" minLength={3} maxLength={24} required autoComplete="username" /></label>}
          <label>{isRegister ? 'Email' : 'Email или никнейм'}<input name={isRegister ? 'email' : 'emailOrUsername'} type={isRegister ? 'email' : 'text'} value={isRegister ? form.email : form.emailOrUsername} onChange={update} placeholder={isRegister ? 'you@example.com' : 'Твой email или никнейм'} required autoComplete={isRegister ? 'email' : 'username'} /></label>
          <label>Пароль<div className="password-field"><input name="password" type={showPassword ? 'text' : 'password'} value={form.password} onChange={update} placeholder="Минимум 8 символов" minLength={8} maxLength={72} required autoComplete={isRegister ? 'new-password' : 'current-password'} /><button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? 'Скрыть пароль' : 'Показать пароль'}>{showPassword ? <EyeOff size={18}/> : <Eye size={18}/>}</button></div></label>
          {error && <div className="auth-error" role="alert">{error}</div>}
          <button className="auth-submit" type="submit" disabled={submitting}>{submitting ? 'Подожди...' : isRegister ? 'Создать аккаунт' : 'Войти'} <ArrowRight size={17}/></button>
        </form>

        <div className="auth-switch">{isRegister ? 'Уже есть аккаунт?' : 'Впервые в GameHub?'} <Link to={isRegister ? '/login' : '/register'}>{isRegister ? 'Войти' : 'Создать аккаунт'}</Link></div>
        <div className="auth-security"><ShieldCheck size={15}/> Твои данные защищены</div>
      </section>
      <aside className="auth-aside"><div className="auth-aside-orb orb-a"/><div className="auth-aside-orb orb-b"/><div className="auth-aside-content"><span>GAMEHUB COMMUNITY</span><h2>Твоя коллекция.<br/>Твои достижения.<br/><em>Твоя история.</em></h2><p>Одно место для всего, что делает игры особенными.</p><div className="auth-feature"><Gamepad2 size={20}/><span>Открой свою игровую вселенную</span></div></div></aside>
    </main>
  );
}
