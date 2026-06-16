import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { consumeReturnUrl } from '../lib/authReturn';
import { Wallet, Eye, EyeOff } from 'lucide-react';
import toast from 'react-hot-toast';
import { useTour } from '../contexts/TourContext';

const LoginPage = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [tgUsername, setTgUsername] = useState('');
  const [phone, setPhone] = useState('');
  const [tinkoffToken, setTinkoffToken] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { login, register, isAuthenticated, isInitializing } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { startTour } = useTour();

  useEffect(() => {
    if (isInitializing || isAuthenticated) return;
    startTour(false);
  }, [isInitializing, isAuthenticated, startTour]);

  useEffect(() => {
    if (!isAuthenticated) return;

    const isTelegram = typeof window !== 'undefined' &&
      (window as Window & { Telegram?: { WebApp?: { initData?: string } } }).Telegram?.WebApp?.initData ||
      window.location.search.includes('tgWebAppStartParam');

    const isMobileRoute = localStorage.getItem('preferredMobileRoute') === 'true';
    const fromPath = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname;
    const fallback = isTelegram || isMobileRoute ? '/mobile' : '/';
    const target = fromPath && fromPath !== '/login' ? fromPath : consumeReturnUrl(fallback);

    navigate(target, { replace: true });
  }, [isAuthenticated, navigate, location.state]);

  useEffect(() => {
    if (isLogin) {
      setTgUsername('');
      setPhone('');
      setTinkoffToken('');
    }
  }, [isLogin]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Валидация на клиенте
    if (!email || !password) {
      toast.error('Заполните обязательные поля');
      return;
    }

    if (!isLogin) {
      if (!tgUsername.trim()) {
        toast.error('Логин сервиса обязателен');
        return;
      }
      if (tgUsername.trim().length < 3) {
        toast.error('Логин сервиса: минимум 3 символа');
        return;
      }
      if (!/^[a-zA-Z0-9._-]+$/.test(tgUsername.trim())) {
        toast.error('Логин: только латиница, цифры и . _ -');
        return;
      }
      if (password.length < 8) {
        toast.error('Пароль: минимум 8 символов');
        return;
      }
      if (!/[a-z]/.test(password) || !/[A-Z]/.test(password)) {
        toast.error('Пароль: нужны строчная и прописная латинские буквы');
        return;
      }
      if (!/^[\x21-\x7E]+$/.test(password)) {
        toast.error('Пароль: только латиница, цифры и спецсимволы');
        return;
      }
      if (phone && phone.trim().length > 0 && !/^\+?\d{10,15}$/.test(phone.trim())) {
        toast.error('Телефон должен содержать 10-15 цифр (можно с + в начале)');
        return;
      }
    }

    setLoading(true);
    try {
      if (isLogin) {
        await login(email.trim(), password);
      } else {
        await register(
          email.trim(),
          password,
          tgUsername.trim(),
          phone?.trim() || undefined,
          tinkoffToken?.trim() || undefined
        );
      }
      // Навигация произойдет автоматически через useEffect при изменении isAuthenticated
    } catch (error: any) {
      // Ошибка уже обработана в interceptor с понятным сообщением
      // Не нужно ничего делать здесь, просто не переходим дальше
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <div className="flex justify-center">
            <Wallet className="h-12 w-12 text-primary-600 dark:text-primary-400" />
          </div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900 dark:text-gray-100">
            {isLogin ? 'Вход в систему' : 'Регистрация'}
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600 dark:text-gray-400">
            {isLogin ? (
              <>
                Нет аккаунта?{' '}
                <button
                  onClick={() => setIsLogin(false)}
                  className="font-medium text-primary-600 dark:text-primary-400 hover:text-primary-500 dark:hover:text-primary-300"
                >
                  Зарегистрироваться
                </button>
              </>
            ) : (
              <>
                Уже есть аккаунт?{' '}
                <button
                  onClick={() => setIsLogin(true)}
                  className="font-medium text-primary-600 dark:text-primary-400 hover:text-primary-500 dark:hover:text-primary-300"
                >
                  Войти
                </button>
              </>
            )}
          </p>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleSubmit} data-tour="login-form">
          <div className="rounded-md shadow-sm space-y-4" data-tour="login-register-fields">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                className="input"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Пароль
              </label>
              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete={isLogin ? 'current-password' : 'new-password'}
                  required
                  className="input pr-10"
                  placeholder={isLogin ? 'Пароль' : 'мин. 8 символов, Aa и спецсимволы'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-2 flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                  onClick={() => setShowPassword((v) => !v)}
                  tabIndex={-1}
                  aria-label={showPassword ? 'Скрыть пароль' : 'Показать пароль'}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {!isLogin && (
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Латиница: строчные и прописные, цифры, спецсимволы. Без кириллицы.
                </p>
              )}
            </div>
            
            {!isLogin && (
              <>
                <div>
                  <label htmlFor="tg_username" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Логин сервиса <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="tg_username"
                    name="tg_username"
                    type="text"
                    required
                    className="input"
                    placeholder="ivan_01"
                    value={tgUsername}
                    onChange={(e) => setTgUsername(e.target.value)}
                  />
                </div>
                <div>
                  <label htmlFor="phone" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Телефон
                  </label>
                  <input
                    id="phone"
                    name="phone"
                    type="tel"
                    className="input"
                    placeholder="+79991234567"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </div>
                <div>
                  <label htmlFor="tinkoff_token" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Токен Тинькофф (необязательно)
                  </label>
                  <input
                    id="tinkoff_token"
                    name="tinkoff_token"
                    type="text"
                    className="input"
                    placeholder="t.xxxxxx"
                    value={tinkoffToken}
                    onChange={(e) => setTinkoffToken(e.target.value)}
                  />
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    Можно ввести позже в личном кабинете.
                  </p>
                </div>
              </>
            )}
          </div>

          <div>
            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary w-full"
            >
              {loading ? 'Загрузка...' : isLogin ? 'Войти' : 'Зарегистрироваться'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default LoginPage;

