import { ReactNode } from 'react';

export const AdminHelpHint = ({ children }: { children: ReactNode }) => (
  <div className="admin-help-hint">{children}</div>
);

/* ── Секция с заголовком ── */

interface AdminSectionProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}

export const AdminSection = ({ title, subtitle, actions, children, className = '' }: AdminSectionProps) => (
  <section className={`admin-section ${className}`}>
    <div className="admin-section-header">
      <div>
        <h3 className="admin-section-title">{title}</h3>
        {subtitle && <p className="admin-section-subtitle">{subtitle}</p>}
      </div>
      {actions && <div className="admin-section-actions">{actions}</div>}
    </div>
    <div className="admin-section-body">{children}</div>
  </section>
);

/* ── Таблица ── */

interface AdminTableProps {
  children: ReactNode;
  maxHeight?: string;
  className?: string;
}

export const AdminTableWrap = ({ children, maxHeight, className = '' }: AdminTableProps) => (
  <div
    className={`admin-table-wrap custom-scrollbar ${className}`}
    style={maxHeight ? { maxHeight } : undefined}
  >
    <table className="admin-table">{children}</table>
  </div>
);

export const AdminTableHead = ({ children }: { children: ReactNode }) => (
  <thead className="admin-table-head">{children}</thead>
);

export const AdminTableBody = ({ children }: { children: ReactNode }) => (
  <tbody className="admin-table-body">{children}</tbody>
);

export const AdminEmptyRow = ({ colSpan, children = 'Нет данных' }: { colSpan: number; children?: ReactNode }) => (
  <tr>
    <td colSpan={colSpan} className="admin-table-empty">
      {children}
    </td>
  </tr>
);

/* ── Формы ── */

export const adminInputClass = 'admin-input';
export const adminSelectClass = 'admin-select';

interface AdminFieldProps {
  label: string;
  children: ReactNode;
  className?: string;
}

export const AdminField = ({ label, children, className = '' }: AdminFieldProps) => (
  <label className={`admin-field ${className}`}>
    <span className="admin-field-label">{label}</span>
    {children}
  </label>
);

export const AdminFormRow = ({ children }: { children: ReactNode }) => (
  <div className="admin-form-row">{children}</div>
);

/* ── Статистика ── */

interface StatItem {
  label: string;
  value: string;
  tone?: 'default' | 'green' | 'red' | 'blue' | 'amber';
}

export const AdminStatGrid = ({ items }: { items: StatItem[] }) => (
  <div className="admin-stat-grid">
    {items.map((item) => (
      <div key={item.label} className={`admin-stat-card admin-stat-${item.tone || 'default'}`}>
        <div className="admin-stat-label">{item.label}</div>
        <div className="admin-stat-value">{item.value}</div>
      </div>
    ))}
  </div>
);

/* ── Бейджи ── */

const badgeTone: Record<string, string> = {
  ok: 'admin-badge-ok',
  warn: 'admin-badge-warn',
  danger: 'admin-badge-danger',
  muted: 'admin-badge-muted',
};

export const AdminBadge = ({ tone = 'muted', children }: { tone?: keyof typeof badgeTone; children: ReactNode }) => (
  <span className={`admin-badge ${badgeTone[tone] || badgeTone.muted}`}>{children}</span>
);

/* ── Toolbar ── */

export const AdminToolbar = ({ left, right }: { left?: ReactNode; right?: ReactNode }) => (
  <div className="admin-toolbar">
    <div className="admin-toolbar-left">{left}</div>
    {right && <div className="admin-toolbar-right">{right}</div>}
  </div>
);

export const AdminLoading = () => (
  <div className="admin-loading">
    <div className="admin-loading-spinner" />
    <span>Загрузка...</span>
  </div>
);

/* ── Кнопка удаления в таблице ── */

export const AdminDeleteBtn = ({ onClick, label = 'Удалить' }: { onClick: () => void; label?: string }) => (
  <button type="button" className="admin-link-danger" onClick={onClick}>
    {label}
  </button>
);
