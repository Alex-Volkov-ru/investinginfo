// Система черновиков для форм
class DraftManager {
  constructor() {
    this.autoSaveInterval = null;
    this.autoSaveDelay = 60000; // 60 секунд - раз в минуту
  }

  // Сохранение черновика
  saveDraft(formId, data) {
    try {
      const draft = {
        data: data,
        timestamp: Date.now(),
        formId: formId
      };
      localStorage.setItem(`draft_${formId}`, JSON.stringify(draft));
      this.showDraftIndicator(formId, true);
    } catch (error) {
      console.error('Ошибка сохранения черновика:', error);
    }
  }

  // Загрузка черновика
  loadDraft(formId) {
    try {
      const draft = localStorage.getItem(`draft_${formId}`);
      if (draft) {
        const parsed = JSON.parse(draft);
        this.showDraftIndicator(formId, true);
        return parsed.data;
      }
    } catch (error) {
      console.error('Ошибка загрузки черновика:', error);
    }
    return null;
  }

  // Удаление черновика
  clearDraft(formId) {
    try {
      localStorage.removeItem(`draft_${formId}`);
      this.showDraftIndicator(formId, false);
    } catch (error) {
      console.error('Ошибка удаления черновика:', error);
    }
  }

  // Показать индикатор черновика
  showDraftIndicator(formId, hasDraft) {
    const form = document.getElementById(formId);
    if (!form) return;

    let indicator = form.querySelector('.draft-indicator');
    
    if (hasDraft) {
      if (!indicator) {
        indicator = document.createElement('div');
        indicator.className = 'draft-indicator';
        indicator.innerHTML = '💾 Черновик сохранен';
        indicator.style.cssText = `
          position: absolute;
          top: -25px;
          right: 0;
          background: var(--warn);
          color: white;
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 11px;
          z-index: 100;
        `;
        form.style.position = 'relative';
        form.appendChild(indicator);
      }
    } else if (indicator) {
      indicator.remove();
    }
  }

  // Автосохранение для формы
  enableAutoSave(formId, getFormData) {
    const form = document.getElementById(formId);
    if (!form) return;

    // Загружаем существующий черновик
    const existingDraft = this.loadDraft(formId);
    if (existingDraft && getFormData) {
      // Восстанавливаем данные в форму
      this.restoreFormData(form, existingDraft);
    }

    // Запускаем автосохранение
    this.autoSaveInterval = setInterval(() => {
      if (getFormData) {
        const data = getFormData();
        if (data && Object.keys(data).length > 0) {
          this.saveDraft(formId, data);
        }
      }
    }, this.autoSaveDelay);

    // Сохраняем при изменении полей
    form.addEventListener('input', () => {
      if (getFormData) {
        const data = getFormData();
        this.saveDraft(formId, data);
      }
    });
  }

  // Остановить автосохранение
  stopAutoSave() {
    if (this.autoSaveInterval) {
      clearInterval(this.autoSaveInterval);
      this.autoSaveInterval = null;
    }
  }

  // Восстановить данные в форму
  restoreFormData(form, data) {
    Object.keys(data).forEach(key => {
      const field = form.querySelector(`[name="${key}"]`);
      if (field) {
        if (field.type === 'checkbox') {
          field.checked = data[key];
        } else {
          field.value = data[key];
        }
      }
    });
  }

  // Получить все черновики
  getAllDrafts() {
    const drafts = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('draft_')) {
        try {
          const draft = JSON.parse(localStorage.getItem(key));
          drafts.push({
            formId: draft.formId,
            timestamp: draft.timestamp,
            data: draft.data
          });
        } catch (error) {
          console.error('Ошибка парсинга черновика:', error);
        }
      }
    }
    return drafts.sort((a, b) => b.timestamp - a.timestamp);
  }

  // Показать модалку с черновиками
  showDraftsModal() {
    const drafts = this.getAllDrafts();
    if (drafts.length === 0) {
      toast('Нет сохраненных черновиков');
      return;
    }

    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.style.display = 'flex';
    
    modal.innerHTML = `
      <div class="modal__dialog">
        <div class="modal__header">
          <h3>Черновики</h3>
          <button class="modal__close" onclick="this.closest('.modal').remove()">✕</button>
        </div>
        <div class="modal__body">
          <div class="drafts-list">
            ${drafts.map(draft => `
              <div class="draft-item">
                <div class="draft-info">
                  <strong>${this.getFormName(draft.formId)}</strong>
                  <small>${new Date(draft.timestamp).toLocaleString()}</small>
                </div>
                <div class="draft-actions">
                  <button onclick="draftManager.restoreDraft('${draft.formId}')" class="btn btn-primary">Восстановить</button>
                  <button onclick="draftManager.clearDraft('${draft.formId}')" class="btn btn-danger">Удалить</button>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
    document.body.style.overflow = 'hidden';
  }

  // Восстановить черновик
  restoreDraft(formId) {
    const draft = this.loadDraft(formId);
    if (draft) {
      const form = document.getElementById(formId);
      if (form) {
        this.restoreFormData(form, draft);
        toast('Черновик восстановлен');
      }
    }
  }

  // Получить имя формы
  getFormName(formId) {
    const names = {
      'assetForm': 'Добавление актива',
      'budgetForm': 'Бюджетная транзакция',
      'obligationForm': 'Создание обязательства'
    };
    return names[formId] || formId;
  }
}

// Глобальный экземпляр
window.draftManager = new DraftManager();

// Автоматическое сохранение при закрытии страницы
window.addEventListener('beforeunload', () => {
  window.draftManager.stopAutoSave();
});
