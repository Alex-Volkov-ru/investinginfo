import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import {
  adminService,
  CalendarPayment,
  ObligationRisk,
  ObligationSummaryItem,
  ObligationTemplate,
} from '../../services/adminService';
import { UserListItem } from '../../services/userService';
import {
  AdminDeleteBtn,
  AdminField,
  AdminFormRow,
  AdminLoading,
  AdminSection,
  AdminTableBody,
  AdminTableHead,
  AdminTableWrap,
  adminInputClass,
  adminSelectClass,
} from './AdminUi';

interface Props {
  users: UserListItem[];
}

export const AdminObligationsTab = ({ users }: Props) => {
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<ObligationSummaryItem[]>([]);
  const [calendar, setCalendar] = useState<CalendarPayment[]>([]);
  const [risks, setRisks] = useState<ObligationRisk[]>([]);
  const [templates, setTemplates] = useState<ObligationTemplate[]>([]);
  const [newTpl, setNewTpl] = useState({ title: '', total: '', monthly: '', rate: '', due_day: '1' });
  const [applyTpl, setApplyTpl] = useState<number>(0);
  const [applyUser, setApplyUser] = useState<number>(0);

  const load = async () => {
    setLoading(true);
    try {
      const [s, c, r, t] = await Promise.all([
        adminService.getObligationsSummary(),
        adminService.getObligationsCalendar(),
        adminService.getObligationsRisks(),
        adminService.listObligationTemplates(),
      ]);
      setSummary(s);
      setCalendar(c);
      setRisks(r);
      setTemplates(t);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const onCreateTemplate = async () => {
    if (!newTpl.title.trim()) return;
    await adminService.createObligationTemplate({
      title: newTpl.title.trim(),
      total: parseFloat(newTpl.total) || 0,
      monthly: parseFloat(newTpl.monthly) || 0,
      rate: parseFloat(newTpl.rate) || 0,
      due_day: parseInt(newTpl.due_day, 10) || 1,
      notes: '',
    });
    toast.success('Шаблон создан');
    setNewTpl({ title: '', total: '', monthly: '', rate: '', due_day: '1' });
    await load();
  };

  const onApplyTemplate = async () => {
    if (!applyTpl || !applyUser) return;
    const r = await adminService.applyObligationTemplate(applyTpl, applyUser);
    toast.success(`Блок создан #${r.block_id}`);
    await load();
  };

  if (loading) return <AdminLoading />;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button type="button" className="btn btn-secondary text-xs min-h-[44px]" onClick={() => void load()}>
          Обновить
        </button>
      </div>

      {risks.length > 0 && (
        <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-3">
          <div className="text-sm font-semibold text-red-700 dark:text-red-300 mb-2">
            Риски и просрочки ({risks.length})
          </div>
          <ul className="text-xs space-y-1">
            {risks.map((r, i) => (
              <li key={i} className="break-words">
                <strong>{r.email}</strong> — {r.title}: {r.message}
                {r.due_date && ` (${format(new Date(r.due_date), 'dd.MM.yyyy')})`}
              </li>
            ))}
          </ul>
        </div>
      )}

      <AdminTableWrap>
        <AdminTableHead>
          <tr>
            <th className="min-w-[100px]">Email</th>
            <th>Название</th>
            <th className="hidden sm:table-cell">Платёж/мес</th>
            <th className="hidden md:table-cell">Остаток</th>
            <th className="hidden lg:table-cell">След. платёж</th>
            <th>Статус</th>
          </tr>
        </AdminTableHead>
        <AdminTableBody>
          {summary.length === 0 ? (
            <tr>
              <td colSpan={6} className="admin-table-empty">Нет обязательств</td>
            </tr>
          ) : (
            summary.map((s) => (
              <tr key={s.block_id}>
                <td className="admin-cell-email">{s.email}</td>
                <td>
                  <div>{s.title}</div>
                  <div className="text-xs admin-cell-muted sm:hidden mt-0.5">
                    {s.monthly.toLocaleString('ru-RU')} ₽/мес • ост. {s.remaining.toLocaleString('ru-RU')} ₽
                  </div>
                </td>
                <td className="hidden sm:table-cell tabular-nums">{s.monthly.toLocaleString('ru-RU')} ₽</td>
                <td className="hidden md:table-cell tabular-nums">{s.remaining.toLocaleString('ru-RU')} ₽</td>
                <td className="hidden lg:table-cell whitespace-nowrap">
                  {s.next_payment ? format(new Date(s.next_payment), 'dd.MM.yyyy') : '—'}
                </td>
                <td>{s.status}</td>
              </tr>
            ))
          )}
        </AdminTableBody>
      </AdminTableWrap>

      <AdminSection title="Календарь платежей">
        {calendar.length === 0 ? (
          <div className="text-xs text-gray-500 px-4 pb-4">Нет платежей в этом месяце</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 text-xs px-4 pb-4">
            {calendar.map((c, i) => (
              <div key={i} className="flex flex-col sm:flex-row sm:justify-between gap-0.5 bg-gray-50 dark:bg-gray-800 rounded px-2 py-2">
                <span className="break-words">
                  {format(new Date(c.date), 'dd.MM')} — {c.title} ({c.email})
                </span>
                <span className="shrink-0 tabular-nums">{c.amount.toLocaleString('ru-RU')} ₽</span>
              </div>
            ))}
          </div>
        )}
      </AdminSection>

      <AdminSection title="Шаблоны обязательств">
        <AdminFormRow>
          <AdminField label="Название" className="flex-1 min-w-[120px]">
            <input className={`${adminInputClass} admin-input-wide`} placeholder="Название" value={newTpl.title} onChange={(e) => setNewTpl({ ...newTpl, title: e.target.value })} />
          </AdminField>
          <AdminField label="Сумма">
            <input className={adminInputClass} placeholder="0" value={newTpl.total} onChange={(e) => setNewTpl({ ...newTpl, total: e.target.value })} />
          </AdminField>
          <AdminField label="Платёж">
            <input className={adminInputClass} placeholder="0" value={newTpl.monthly} onChange={(e) => setNewTpl({ ...newTpl, monthly: e.target.value })} />
          </AdminField>
          <AdminField label="Ставка %">
            <input className={adminInputClass} placeholder="0" value={newTpl.rate} onChange={(e) => setNewTpl({ ...newTpl, rate: e.target.value })} />
          </AdminField>
          <button type="button" className="btn btn-primary text-xs min-h-[44px] self-end" onClick={() => void onCreateTemplate()}>
            Добавить
          </button>
        </AdminFormRow>
        <div className="divide-y divide-gray-100 dark:divide-gray-800">
          {templates.map((t) => (
            <div key={t.id} className="flex flex-col sm:flex-row sm:justify-between gap-1 text-xs px-4 py-2">
              <span>{t.title} — {t.monthly.toLocaleString('ru-RU')} ₽/мес</span>
              <AdminDeleteBtn onClick={() => void adminService.deleteObligationTemplate(t.id).then(load)} />
            </div>
          ))}
        </div>
        {templates.length > 0 && users.length > 0 && (
          <AdminFormRow>
            <AdminField label="Шаблон" className="flex-1">
              <select className={`${adminSelectClass} admin-select-wide`} value={applyTpl} onChange={(e) => setApplyTpl(Number(e.target.value))}>
                <option value={0}>Выберите шаблон...</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>{t.title}</option>
                ))}
              </select>
            </AdminField>
            <AdminField label="Пользователь" className="flex-1">
              <select className={`${adminSelectClass} admin-select-wide`} value={applyUser} onChange={(e) => setApplyUser(Number(e.target.value))}>
                <option value={0}>Выберите пользователя...</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>{u.email}</option>
                ))}
              </select>
            </AdminField>
            <button type="button" className="btn btn-secondary text-xs min-h-[44px] self-end" onClick={() => void onApplyTemplate()}>
              Применить
            </button>
          </AdminFormRow>
        )}
      </AdminSection>
    </div>
  );
};
