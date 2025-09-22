// Обратный отсчет до зарплаты
class SalaryCountdown {
  constructor() {
    // Настройки зарплаты - можно настроить несколько дней
    this.salaryDays = this.loadSalarySettings();
    this.updateInterval = null;
    this.element = null;
  }

  // Загружаем настройки зарплаты
  loadSalarySettings() {
    const saved = localStorage.getItem('salaryDays');
    if (saved) {
      return JSON.parse(saved);
    }
    // По умолчанию - 10 и 25 число
    return [10, 25];
  }

  // Сохраняем настройки
  saveSalarySettings() {
    localStorage.setItem('salaryDays', JSON.stringify(this.salaryDays));
  }

  // Инициализация
  init() {
    this.createElement();
    this.update();
    this.startAutoUpdate();
  }

  // Создание элемента
  createElement() {
    this.element = document.createElement('div');
    this.element.id = 'salaryCountdown';
    this.element.className = 'salary-countdown';
    this.element.innerHTML = `
      <div class="countdown-content">
        <div class="countdown-header">
          <div class="countdown-label">До зарплаты:</div>
          <button class="settings-btn" id="salarySettingsBtn" title="Настройки зарплаты"><span class="icon icon-settings"></span></button>
        </div>
        <div class="countdown-time" id="countdownTime">--</div>
        <div class="countdown-progress">
          <div class="progress-bar" id="progressBar"></div>
        </div>
      </div>
    `;

    // Добавляем стили
    this.element.style.cssText = `
      position: fixed;
      bottom: 20px;
      left: 20px;
      background: var(--card);
      border: 1px solid var(--stroke);
      border-radius: var(--radius);
      padding: 12px 16px;
      box-shadow: var(--shadow);
      z-index: 1000;
      min-width: 160px;
      transition: all 0.3s ease;
    `;

    this.element.querySelector('.countdown-header').style.cssText = `
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 4px;
    `;

    this.element.querySelector('.countdown-label').style.cssText = `
      font-size: 11px;
      color: var(--muted);
      text-transform: uppercase;
      letter-spacing: 0.5px;
    `;

    this.element.querySelector('.settings-btn').style.cssText = `
      background: none;
      border: none;
      color: var(--muted);
      cursor: pointer;
      padding: 2px;
      border-radius: 3px;
      font-size: 12px;
      transition: all 0.2s ease;
    `;

    this.element.querySelector('.settings-btn').addEventListener('mouseenter', function() {
      this.style.background = 'var(--stroke)';
      this.style.color = 'var(--text)';
    });

    this.element.querySelector('.settings-btn').addEventListener('mouseleave', function() {
      this.style.background = 'none';
      this.style.color = 'var(--muted)';
    });

    this.element.querySelector('.countdown-time').style.cssText = `
      font-size: 18px;
      font-weight: 800;
      color: var(--text);
      margin-bottom: 8px;
    `;

    this.element.querySelector('.countdown-progress').style.cssText = `
      width: 100%;
      height: 4px;
      background: var(--stroke);
      border-radius: 2px;
      overflow: hidden;
    `;

    this.element.querySelector('.progress-bar').style.cssText = `
      height: 100%;
      background: linear-gradient(90deg, var(--brand), var(--ok));
      border-radius: 2px;
      transition: width 0.3s ease;
    `;

    // Добавляем в DOM
    document.body.appendChild(this.element);

    // Обработчик настроек
    document.getElementById('salarySettingsBtn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.showSettingsModal();
    });

    // Показываем/скрываем при скролле
    let lastScrollY = window.scrollY;
    window.addEventListener('scroll', () => {
      const currentScrollY = window.scrollY;
      if (currentScrollY > lastScrollY && currentScrollY > 100) {
        this.element.style.transform = 'translateY(100px)';
        this.element.style.opacity = '0.5';
      } else {
        this.element.style.transform = 'translateY(0)';
        this.element.style.opacity = '1';
      }
      lastScrollY = currentScrollY;
    });
  }

  // Обновление отсчета
  update() {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    
    // Находим ближайшую дату зарплаты
    let nearestSalaryDate = null;
    let minDays = Infinity;
    
    // Проверяем все дни зарплаты в этом месяце и следующем
    this.salaryDays.forEach(day => {
      // Дата зарплаты в этом месяце
      let salaryDate = new Date(currentYear, currentMonth, day);
      
      // Если зарплата уже прошла, берем следующий месяц
      if (salaryDate <= now) {
        salaryDate = new Date(currentYear, currentMonth + 1, day);
      }
      
      const daysDiff = Math.ceil((salaryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      
      if (daysDiff < minDays) {
        minDays = daysDiff;
        nearestSalaryDate = salaryDate;
      }
    });

    const timeDiff = nearestSalaryDate.getTime() - now.getTime();
    
    if (timeDiff <= 0) {
      this.element.querySelector('#countdownTime').textContent = 'Сегодня!';
      this.element.querySelector('#progressBar').style.width = '100%';
      this.element.querySelector('#progressBar').style.background = 'var(--ok)';
      return;
    }

    const days = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((timeDiff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));

    // Форматирование времени
    let timeText = '';
    if (days > 0) {
      timeText = `${days} дн.`;
    } else if (hours > 0) {
      timeText = `${hours} ч.`;
    } else {
      timeText = `${minutes} мин.`;
    }

    this.element.querySelector('#countdownTime').textContent = timeText;

    // Прогресс-бар (дни до зарплаты)
    const totalDaysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const daysFromStartOfMonth = now.getDate();
    const progress = Math.min(100, (daysFromStartOfMonth / totalDaysInMonth) * 100);
    
    this.element.querySelector('#progressBar').style.width = `${progress}%`;

    // Цвет прогресс-бара в зависимости от времени
    if (days <= 1) {
      this.element.querySelector('#progressBar').style.background = 'var(--ok)';
    } else if (days <= 3) {
      this.element.querySelector('#progressBar').style.background = 'var(--warn)';
    } else {
      this.element.querySelector('#progressBar').style.background = 'linear-gradient(90deg, var(--brand), var(--ok))';
    }

    // Анимация при приближении зарплаты
    if (days <= 1) {
      this.element.style.animation = 'pulse 2s infinite';
    } else {
      this.element.style.animation = 'none';
    }
  }

  // Автообновление каждую минуту
  startAutoUpdate() {
    this.updateInterval = setInterval(() => {
      this.update();
    }, 60000); // Обновляем каждую минуту
  }

  // Остановка автообновления
  stopAutoUpdate() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
  }

  // Показать модалку настроек
  showSettingsModal() {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.style.display = 'flex';
    
    modal.innerHTML = `
      <div class="modal__dialog" style="max-width: 400px;">
        <div class="modal__header">
          <h3><span class="icon icon-settings"></span> Настройки зарплаты</h3>
          <button class="modal__close" onclick="salaryCountdown.closeModal(this.closest('.modal'))"><span class="icon icon-close"></span></button>
        </div>
        <div class="modal__body">
          <p>Укажите дни получения зарплаты (например: 10, 25 или 15, 30):</p>
          <div class="salary-days-input">
            ${this.salaryDays.map((day, index) => `
              <div class="day-input-group">
                <label>День ${index + 1}:</label>
                <input type="number" min="1" max="31" value="${day}" 
                       onchange="salaryCountdown.updateSalaryDay(${index}, this.value)">
                ${this.salaryDays.length > 1 ? `
                  <button onclick="salaryCountdown.removeSalaryDay(${index})" 
                          class="remove-day-btn" 
                          title="Удалить день">×</button>
                ` : ''}
              </div>
            `).join('')}
            <button onclick="salaryCountdown.addSalaryDay()" 
                    style="background: var(--ok); color: white; border: none; padding: 8px 12px; border-radius: 4px; margin-top: 10px;">
              + Добавить день
            </button>
          </div>
          <div style="margin-top: 20px; text-align: center;">
            <button class="btn btn-primary" onclick="salaryCountdown.closeModal(this.closest('.modal'))">Сохранить</button>
          </div>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    document.body.style.overflow = 'hidden';
    
    // Добавляем обработчик клика вне модального окна
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        this.closeModal(modal);
      }
    });
  }

  // Правильное закрытие модального окна с восстановлением скроллинга
  closeModal(modal) {
    if (modal && modal.parentNode) {
      modal.remove();
      document.body.style.overflow = '';
    }
  }

  // Обновить день зарплаты
  updateSalaryDay(index, value) {
    this.salaryDays[index] = parseInt(value) || 1;
    this.saveSalarySettings();
    this.update();
  }

  // Добавить день зарплаты
  addSalaryDay() {
    this.salaryDays.push(15); // По умолчанию 15 число
    this.saveSalarySettings();
    this.showSettingsModal(); // Перезагружаем модалку
  }

  // Удалить день зарплаты
  removeSalaryDay(index) {
    if (this.salaryDays.length > 1) {
      this.salaryDays.splice(index, 1);
      this.saveSalarySettings();
      this.showSettingsModal(); // Перезагружаем модалку
    }
  }

  // Удаление элемента
  destroy() {
    this.stopAutoUpdate();
    if (this.element && this.element.parentNode) {
      this.element.parentNode.removeChild(this.element);
    }
  }
}

// CSS анимация
const style = document.createElement('style');
style.textContent = `
  @keyframes pulse {
    0% { transform: scale(1); }
    50% { transform: scale(1.05); }
    100% { transform: scale(1); }
  }

  .salary-countdown:hover {
    transform: translateY(-2px) !important;
    box-shadow: var(--shadow-lg) !important;
  }

  @media (max-width: 768px) {
    .salary-countdown {
      bottom: 10px !important;
      left: 10px !important;
      right: 10px !important;
      min-width: auto !important;
    }
  }

  /* Стили для настроек зарплаты */
  .day-input-group {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 15px;
  }
  
  .day-input-group label {
    min-width: 60px;
    margin-bottom: 0;
    font-size: 14px;
    color: var(--text);
  }
  
  .day-input-group input {
    flex: 1;
    margin-bottom: 0;
  }
  
  /* Кнопка удаления дня - большая и видимая для обеих тем */
  .remove-day-btn {
    background: #e74c3c !important;
    color: white !important;
    border: 3px solid #c0392b !important;
    padding: 8px 12px !important;
    border-radius: 8px !important;
    font-size: 18px !important;
    font-weight: bold !important;
    cursor: pointer !important;
    min-width: 45px !important;
    height: 45px !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    transition: all 0.2s ease !important;
    box-shadow: 0 4px 12px rgba(231, 76, 60, 0.6) !important;
    text-shadow: 0 1px 2px rgba(0,0,0,0.3) !important;
  }
  
  /* Темная тема */
  html[data-theme="dark"] .remove-day-btn {
    background: #e74c3c !important;
    border-color: #c0392b !important;
    box-shadow: 0 4px 12px rgba(231, 76, 60, 0.8) !important;
  }
  
  /* Светлая тема - делаем еще контрастнее */
  html[data-theme="light"] .remove-day-btn {
    background: #e74c3c !important;
    border-color: #c0392b !important;
    box-shadow: 0 4px 12px rgba(231, 76, 60, 0.4), inset 0 1px 0 rgba(255,255,255,0.2) !important;
    text-shadow: 0 1px 2px rgba(0,0,0,0.5) !important;
  }
  
  .remove-day-btn:hover {
    background: #c0392b !important;
    border-color: #a93226 !important;
    transform: scale(1.05) !important;
    box-shadow: 0 6px 16px rgba(231, 76, 60, 0.7) !important;
  }
  
  .remove-day-btn:active {
    transform: scale(0.95) !important;
    box-shadow: 0 2px 8px rgba(231, 76, 60, 0.8) !important;
  }
`;
document.head.appendChild(style);

// Глобальный экземпляр
window.salaryCountdown = new SalaryCountdown();
