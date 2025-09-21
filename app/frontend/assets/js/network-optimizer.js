// ============================================================
// Оптимизатор сетевых запросов
// ============================================================

class NetworkOptimizer {
  constructor() {
    this.requestCache = new Map();
    this.requestQueue = new Map();
    this.retryAttempts = new Map();
    this.maxRetries = 3;
    this.retryDelay = 1000;
  }

  // Дебаунс запросов
  debounce(func, delay) {
    let timeoutId;
    return (...args) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => func.apply(this, args), delay);
    };
  }

  // Throttle запросов
  throttle(func, limit) {
    let inThrottle;
    return (...args) => {
      if (!inThrottle) {
        func.apply(this, args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    };
  }

  // Кэширование запросов
  async cachedRequest(url, options = {}, ttl = 300000) { // 5 минут по умолчанию
    const cacheKey = `${url}:${JSON.stringify(options)}`;
    const cached = this.requestCache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < ttl) {
      return cached.data;
    }

    const data = await this.makeRequest(url, options);
    this.requestCache.set(cacheKey, {
      data,
      timestamp: Date.now()
    });
    
    return data;
  }

  // Основной метод запроса с retry логикой
  async makeRequest(url, options = {}) {
    const requestId = `${url}:${Date.now()}`;
    
    // Проверяем, есть ли уже активный запрос
    if (this.requestQueue.has(url)) {
      return this.requestQueue.get(url);
    }

    const requestPromise = this._executeRequest(url, options, requestId);
    this.requestQueue.set(url, requestPromise);

    try {
      const result = await requestPromise;
      this.requestQueue.delete(url);
      return result;
    } catch (error) {
      this.requestQueue.delete(url);
      throw error;
    }
  }

  async _executeRequest(url, options, requestId) {
    const attempts = this.retryAttempts.get(requestId) || 0;
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 сек таймаут

      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers
        }
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      // Сбрасываем счетчик попыток при успехе
      this.retryAttempts.delete(requestId);
      
      return await response.json();
    } catch (error) {
      if (attempts < this.maxRetries && error.name !== 'AbortError') {
        this.retryAttempts.set(requestId, attempts + 1);
        await this._delay(this.retryDelay * Math.pow(2, attempts)); // Exponential backoff
        return this._executeRequest(url, options, requestId);
      }
      
      this.retryAttempts.delete(requestId);
      throw error;
    }
  }

  _delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Batch запросы
  async batchRequests(requests) {
    const promises = requests.map(({ url, options }) => 
      this.cachedRequest(url, options)
    );
    
    return Promise.allSettled(promises);
  }

  // Очистка кэша
  clearCache() {
    this.requestCache.clear();
  }

  // Предзагрузка критических ресурсов
  preloadCritical() {
    const criticalUrls = [
      '/api/budget/summary/month',
      '/api/budget/accounts',
      '/api/budget/categories'
    ];

    criticalUrls.forEach(url => {
      this.cachedRequest(url).catch(() => {
        // Игнорируем ошибки предзагрузки
      });
    });
  }
}

// Глобальный экземпляр
window.networkOptimizer = new NetworkOptimizer();

// Предзагрузка при загрузке страницы (отключена для стабильности)
// document.addEventListener('DOMContentLoaded', () => {
//   window.networkOptimizer.preloadCritical();
// });
