import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Wallet } from 'lucide-react';
import toast from 'react-hot-toast';

const LoginPage = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [tgUsername, setTgUsername] = useState('');
  const [phone, setPhone] = useState('');
  const [tinkoffToken, setTinkoffToken] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, register, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (isAuthenticated) {
      // Определяем, открыто ли приложение в Telegram WebView
      const isTelegram = typeof window !== 'undefined' && 
        (window as any).Telegram?.WebApp?.initData || 
        window.location.search.includes('tgWebAppStartParam');
      
      // Проверяем, есть ли в localStorage информация о мобильной версии
      const isMobileRoute = localStorage.getItem('preferredMobileRoute') === 'true';
      
      // Если это Telegram или была сохранена мобильная версия, идем в мобильную версию
      if (isTelegram || isMobileRoute) {
        navigate('/mobile');
      } else {
        navigate('/');
      }
    }
  }, [isAuthenticated, navigate]);

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
      // Валидация для регистрации
      if (password.length < 6) {
        toast.error('Пароль должен содержать минимум 6 символов');
        return;
      }
      if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) {
        toast.error('Пароль должен содержать буквы и цифры');
        return;
      }
      if (tgUsername && tgUsername.trim().length > 0 && tgUsername.trim().length < 2) {
        toast.error('Имя должно содержать минимум 2 символа');
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
          tgUsername?.trim() || undefined,
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
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="rounded-md shadow-sm space-y-4">
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
              <input
                id="password"
                name="password"
                type="password"
                autoComplete={isLogin ? "current-password" : "new-password"}
                required
                className="input"
                placeholder={isLogin ? "Пароль" : "минимум 6 символов, буквы и цифры"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            
            {!isLogin && (
              <>
                <div>
                  <label htmlFor="tg_username" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Имя (ник)
                  </label>
                  <input
                    id="tg_username"
                    name="tg_username"
                    type="text"
                    className="input"
                    placeholder="например, ivan"
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

