import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { consumeReturnUrl } from '../lib/authReturn';
import { Wallet, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { useTour } from '../contexts/TourContext';
import { triggerAuthTransition } from '../lib/authTransition';

const LoginPage = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [tgUsername, setTgUsername] = useState('');
  const [phone, setPhone] = useState('');
  const [tinkoffToken, setTinkoffToken] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<string>('');
  const [apiFieldErrors, setApiFieldErrors] = useState<{
    email?: string;
    full_name?: string;
    password?: string;
    tg_username?: string;
    phone?: string;
  }>({});
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [touched, setTouched] = useState<Record<'email' | 'full_name' | 'password' | 'tg_username' | 'phone', boolean>>({
    email: false,
    full_name: false,
    password: false,
    tg_username: false,
    phone: false,
  });
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
      setFullName('');
      setPhone('');
      setTinkoffToken('');
      setFormError('');
      setApiFieldErrors({});
      setSubmitAttempted(false);
      setTouched({ email: false, full_name: false, password: false, tg_username: false, phone: false });
    }
  }, [isLogin]);

  const emailValue = email.trim();
  const tgLoginValue = tgUsername.trim();
  const phoneValue = phone.trim();
  const passwordChecks = useMemo(() => ({
    minLen: password.length >= 8,
    lowerUpper: /[a-z]/.test(password) && /[A-Z]/.test(password),
    ascii: /^[\x21-\x7E]+$/.test(password),
  }), [password]);
  const passwordScore = Number(passwordChecks.minLen) + Number(passwordChecks.lowerUpper) + Number(passwordChecks.ascii);
  const passwordScorePct = (passwordScore / 3) * 100;
  const passwordStrengthLabel = passwordScore <= 1 ? 'Слабый' : passwordScore === 2 ? 'Средний' : 'Надежный';
  const passwordStrengthClass = passwordScore <= 1 ? 'bg-red-500' : passwordScore === 2 ? 'bg-amber-500' : 'bg-green-500';
  const emailValid = emailValue.length > 0 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailValue);
  const serviceLoginValid = tgLoginValue.length >= 3 && /^[a-zA-Z0-9._-]+$/.test(tgLoginValue);
  const phoneValid = !phoneValue || /^\+?\d{10,15}$/.test(phoneValue);
  const isPasswordStrong = passwordChecks.minLen && passwordChecks.lowerUpper && passwordChecks.ascii;
  const shouldShowField = (name: 'email' | 'full_name' | 'password' | 'tg_username' | 'phone') => submitAttempted || touched[name];

  const fieldError = {
    email: shouldShowField('email')
      ? (!emailValue ? 'Email обязателен.' : (!emailValid ? 'Введите корректный email (например, user@example.com).' : ''))
      : '',
    fullName: !isLogin && shouldShowField('full_name')
      ? (!fullName.trim() ? 'Имя обязательно.' : (fullName.trim().length < 2 ? 'Имя: минимум 2 символа.' : ''))
      : '',
    password: shouldShowField('password')
      ? (!password ? 'Пароль обязателен.' : (!isLogin && !isPasswordStrong ? 'Пароль не соответствует требованиям.' : ''))
      : '',
    tgUsername: !isLogin && shouldShowField('tg_username')
      ? (!tgLoginValue ? 'Логин сервиса обязателен.' : (!serviceLoginValid ? 'Только латиница, цифры и символы . _ -, минимум 3 символа.' : ''))
      : '',
    phone: !isLogin && shouldShowField('phone') && phoneValue && !phoneValid
      ? 'Телефон: 10-15 цифр, можно с + в начале.'
      : '',
  };
  const visibleErrors = [
    fieldError.email || apiFieldErrors.email,
    !isLogin ? (fieldError.fullName || apiFieldErrors.full_name) : '',
    fieldError.password || apiFieldErrors.password,
    !isLogin ? (fieldError.tgUsername || apiFieldErrors.tg_username) : '',
    !isLogin ? (fieldError.phone || apiFieldErrors.phone) : '',
  ].filter((msg): msg is string => Boolean(msg));

  const fieldValid = {
    email: !!emailValue && emailValid && !apiFieldErrors.email,
    fullName: !isLogin && fullName.trim().length >= 2 && !apiFieldErrors.full_name,
    password: !!password && (isLogin || isPasswordStrong) && !apiFieldErrors.password,
    tgUsername: !isLogin && !!tgLoginValue && serviceLoginValid && !apiFieldErrors.tg_username,
    phone: !isLogin && !!phoneValue && phoneValid && !apiFieldErrors.phone,
  };

  const parseApiError = (error: any): { message: string; fields: typeof apiFieldErrors } => {
    const status = error?.response?.status;
    const detail = error?.response?.data?.detail;
    const fields: typeof apiFieldErrors = {};

    if (status === 429) {
      return { message: 'Слишком много попыток. Подождите немного и попробуйте снова.', fields };
    }
    if (status === 503) {
      return { message: 'Сервис временно недоступен. Попробуйте еще раз через минуту.', fields };
    }
    if (typeof detail === 'string') {
      return { message: detail, fields };
    }
    if (Array.isArray(detail)) {
      const parts = detail.map((item: { loc?: Array<string | number>; msg?: string }) => {
        const field = String(item.loc?.[1] || '');
        const msg = item.msg || 'ошибка';
        if (field === 'email') fields.email = msg;
        if (field === 'full_name') fields.full_name = msg;
        if (field === 'password') fields.password = msg;
        if (field === 'tg_username') fields.tg_username = msg;
        if (field === 'phone') fields.phone = msg;
        return field ? `${field}: ${msg}` : msg;
      });
      return { message: parts.join('; '), fields };
    }
    return {
      message: isLogin ? 'Не удалось войти. Проверьте email и пароль.' : 'Не удалось зарегистрироваться. Проверьте данные формы.',
      fields,
    };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitAttempted(true);
    setFormError('');
    setApiFieldErrors({});

    const hasClientErrors = Boolean(
      fieldError.email ||
      (!isLogin && fieldError.fullName) ||
      fieldError.password ||
      (!isLogin && fieldError.tgUsername) ||
      (!isLogin && fieldError.phone)
    );
    if (hasClientErrors) {
      setFormError('Проверьте поля формы.');
      return;
    }

    setLoading(true);
    try {
      if (isLogin) {
        await login(email.trim(), password);
      } else {
        await register(
          email.trim(),
          fullName.trim(),
          password,
          tgUsername.trim(),
          phone?.trim() || undefined,
          tinkoffToken?.trim() || undefined
        );
      }
      triggerAuthTransition();
      // Навигация произойдет автоматически через useEffect при изменении isAuthenticated
    } catch (error: any) {
      const parsed = parseApiError(error);
      setApiFieldErrors(parsed.fields);
      setFormError(parsed.message);
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
        <form className="mt-8 space-y-6" onSubmit={handleSubmit} data-tour="login-form" noValidate>
          {submitAttempted && visibleErrors.length > 0 && (
            <div className="rounded-lg border border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/20 px-3 py-2 text-sm text-red-700 dark:text-red-200">
              <div className="flex items-center gap-2 font-medium mb-1">
                <AlertCircle className="h-4 w-4" />
                Проверьте заполнение формы
              </div>
              <ul className="list-disc pl-5 space-y-0.5">
                {visibleErrors.map((err, idx) => (
                  <li key={`${err}-${idx}`}>{err}</li>
                ))}
              </ul>
            </div>
          )}
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
                className={`input ${fieldError.email || apiFieldErrors.email ? 'border-red-500 focus:border-red-500' : fieldValid.email ? 'border-green-500 focus:border-green-500' : ''}`}
                placeholder="you@example.com"
                value={email}
                onBlur={() => setTouched((prev) => ({ ...prev, email: true }))}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setApiFieldErrors((prev) => ({ ...prev, email: undefined }));
                }}
              />
              {(fieldError.email || apiFieldErrors.email) && <p className="mt-1 text-xs text-red-500">{apiFieldErrors.email || fieldError.email}</p>}
              {fieldValid.email && <p className="mt-1 text-xs text-green-500">Email выглядит корректно.</p>}
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
                  className={`input pr-10 ${fieldError.password || apiFieldErrors.password ? 'border-red-500 focus:border-red-500' : fieldValid.password ? 'border-green-500 focus:border-green-500' : ''}`}
                  placeholder={isLogin ? 'Пароль' : 'мин. 8 символов, Aa и спецсимволы'}
                  value={password}
                  onBlur={() => setTouched((prev) => ({ ...prev, password: true }))}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setApiFieldErrors((prev) => ({ ...prev, password: undefined }));
                  }}
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
              {(fieldError.password || apiFieldErrors.password) && <p className="mt-1 text-xs text-red-500">{apiFieldErrors.password || fieldError.password}</p>}
              {!isLogin && password.length > 0 && (
                <div className="mt-2 space-y-1 text-xs">
                  <div className="h-1.5 w-full rounded bg-gray-200 dark:bg-gray-700 overflow-hidden">
                    <div className={`h-full transition-all ${passwordStrengthClass}`} style={{ width: `${passwordScorePct}%` }} />
                  </div>
                  <p className="text-gray-500 dark:text-gray-400">Сила пароля: <span className="font-medium">{passwordStrengthLabel}</span></p>
                  <p className={passwordChecks.minLen ? 'text-green-500' : 'text-gray-500 dark:text-gray-400'}>• Минимум 8 символов</p>
                  <p className={passwordChecks.lowerUpper ? 'text-green-500' : 'text-gray-500 dark:text-gray-400'}>• Хотя бы одна строчная и одна прописная буква</p>
                  <p className={passwordChecks.ascii ? 'text-green-500' : 'text-gray-500 dark:text-gray-400'}>• Только латиница/цифры/спецсимволы</p>
                </div>
              )}
            </div>
            
            {!isLogin && (
              <>
                <div>
                  <label htmlFor="full_name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Имя <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="full_name"
                    name="full_name"
                    type="text"
                    className={`input ${fieldError.fullName || apiFieldErrors.full_name ? 'border-red-500 focus:border-red-500' : fieldValid.fullName ? 'border-green-500 focus:border-green-500' : ''}`}
                    placeholder="Александр"
                    value={fullName}
                    onBlur={() => setTouched((prev) => ({ ...prev, full_name: true }))}
                    onChange={(e) => {
                      setFullName(e.target.value);
                      setApiFieldErrors((prev) => ({ ...prev, full_name: undefined }));
                    }}
                  />
                  {(fieldError.fullName || apiFieldErrors.full_name) && <p className="mt-1 text-xs text-red-500">{apiFieldErrors.full_name || fieldError.fullName}</p>}
                  {fieldValid.fullName && <p className="mt-1 text-xs text-green-500">Имя выглядит корректно.</p>}
                </div>
                <div>
                  <label htmlFor="tg_username" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Логин сервиса <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="tg_username"
                    name="tg_username"
                    type="text"
                    className={`input ${fieldError.tgUsername || apiFieldErrors.tg_username ? 'border-red-500 focus:border-red-500' : fieldValid.tgUsername ? 'border-green-500 focus:border-green-500' : ''}`}
                    placeholder="ivan_01"
                    value={tgUsername}
                    onBlur={() => setTouched((prev) => ({ ...prev, tg_username: true }))}
                    onChange={(e) => {
                      setTgUsername(e.target.value);
                      setApiFieldErrors((prev) => ({ ...prev, tg_username: undefined }));
                    }}
                  />
                  {(fieldError.tgUsername || apiFieldErrors.tg_username) && <p className="mt-1 text-xs text-red-500">{apiFieldErrors.tg_username || fieldError.tgUsername}</p>}
                  {fieldValid.tgUsername && <p className="mt-1 text-xs text-green-500">Логин сервиса валиден.</p>}
                </div>
                <div>
                  <label htmlFor="phone" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Телефон
                  </label>
                  <input
                    id="phone"
                    name="phone"
                    type="tel"
                    className={`input ${fieldError.phone || apiFieldErrors.phone ? 'border-red-500 focus:border-red-500' : fieldValid.phone ? 'border-green-500 focus:border-green-500' : ''}`}
                    placeholder="+79991234567"
                    value={phone}
                    onBlur={() => setTouched((prev) => ({ ...prev, phone: true }))}
                    onChange={(e) => {
                      setPhone(e.target.value);
                      setApiFieldErrors((prev) => ({ ...prev, phone: undefined }));
                    }}
                  />
                  {(fieldError.phone || apiFieldErrors.phone) && <p className="mt-1 text-xs text-red-500">{apiFieldErrors.phone || fieldError.phone}</p>}
                  {fieldValid.phone && <p className="mt-1 text-xs text-green-500">Формат телефона корректный.</p>}
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

          {formError && (
            <div className="rounded-lg border border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/20 px-3 py-2 text-sm text-red-700 dark:text-red-200">
              {formError}
            </div>
          )}

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

