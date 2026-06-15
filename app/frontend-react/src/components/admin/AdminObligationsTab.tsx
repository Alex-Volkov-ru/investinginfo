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

  if (loading) return <div className="text-sm text-gray-600 dark:text-gray-400">Загрузка...</div>;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button className="btn btn-secondary text-xs" onClick={() => void load()}>Обновить</button>
      </div>

      {risks.length > 0 && (
        <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-3">
          <div className="text-sm font-semibold text-red-700 dark:text-red-300 mb-2">Риски и просрочки ({risks.length})</div>
          <ul className="text-xs space-y-1">
            {risks.map((r, i) => (
              <li key={i}>
                <strong>{r.email}</strong> — {r.title}: {r.message}
                {r.due_date && ` (${format(new Date(r.due_date), 'dd.MM.yyyy')})`}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-xs divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-800">
            <tr>
              <th className="px-2 py-2 text-left">Email</th>
              <th className="px-2 py-2 text-left">Название</th>
              <th className="px-2 py-2 text-left">Платёж/мес</th>
              <th className="px-2 py-2 text-left">Остаток</th>
              <th className="px-2 py-2 text-left">След. платёж</th>
              <th className="px-2 py-2 text-left">Статус</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {summary.length === 0 ? (
              <tr><td colSpan={6} className="px-2 py-4 text-gray-500">Нет обязательств</td></tr>
            ) : summary.map((s) => (
              <tr key={s.block_id}>
                <td className="px-2 py-2">{s.email}</td>
                <td className="px-2 py-2">{s.title}</td>
                <td className="px-2 py-2">{s.monthly.toLocaleString('ru-RU')} ₽</td>
                <td className="px-2 py-2">{s.remaining.toLocaleString('ru-RU')} ₽</td>
                <td className="px-2 py-2">{s.next_payment ? format(new Date(s.next_payment), 'dd.MM.yyyy') : '—'}</td>
                <td className="px-2 py-2">{s.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div>
        <div className="text-sm font-semibold mb-2">Календарь платежей</div>
        {calendar.length === 0 ? (
          <div className="text-xs text-gray-500">Нет платежей в этом месяце</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 text-xs">
            {calendar.map((c, i) => (
              <div key={i} className="flex justify-between bg-gray-50 dark:bg-gray-800 rounded px-2 py-1">
                <span>{format(new Date(c.date), 'dd.MM')} — {c.title} ({c.email})</span>
                <span>{c.amount.toLocaleString('ru-RU')} ₽</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="border-t border-gray-200 dark:border-gray-700 pt-3">
        <div className="text-sm font-semibold mb-2">Шаблоны обязательств</div>
        <div className="flex flex-wrap gap-2 mb-2">
          <input className="rounded border px-2 py-1 text-xs dark:bg-gray-900 flex-1 min-w-[100px]" placeholder="Название" value={newTpl.title} onChange={(e) => setNewTpl({ ...newTpl, title: e.target.value })} />
          <input className="rounded border px-2 py-1 text-xs dark:bg-gray-900 w-20" placeholder="Сумма" value={newTpl.total} onChange={(e) => setNewTpl({ ...newTpl, total: e.target.value })} />
          <input className="rounded border px-2 py-1 text-xs dark:bg-gray-900 w-20" placeholder="Платёж" value={newTpl.monthly} onChange={(e) => setNewTpl({ ...newTpl, monthly: e.target.value })} />
          <input className="rounded border px-2 py-1 text-xs dark:bg-gray-900 w-16" placeholder="%" value={newTpl.rate} onChange={(e) => setNewTpl({ ...newTpl, rate: e.target.value })} />
          <button className="btn btn-primary text-xs" onClick={() => void onCreateTemplate()}>Добавить</button>
        </div>
        {templates.map((t) => (
          <div key={t.id} className="flex justify-between text-xs py-1">
            <span>{t.title} — {t.monthly.toLocaleString('ru-RU')} ₽/мес</span>
            <button className="text-red-500" onClick={() => void adminService.deleteObligationTemplate(t.id).then(load)}>удалить</button>
          </div>
        ))}
        {templates.length > 0 && users.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2">
            <select className="rounded border px-2 py-1 text-xs dark:bg-gray-900" value={applyTpl} onChange={(e) => setApplyTpl(Number(e.target.value))}>
              <option value={0}>Шаблон...</option>
              {templates.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
            </select>
            <select className="rounded border px-2 py-1 text-xs dark:bg-gray-900" value={applyUser} onChange={(e) => setApplyUser(Number(e.target.value))}>
              <option value={0}>Пользователь...</option>
              {users.map((u) => <option key={u.id} value={u.id}>{u.email}</option>)}
            </select>
            <button className="btn btn-secondary text-xs" onClick={() => void onApplyTemplate()}>Применить шаблон</button>
          </div>
        )}
      </div>
    </div>
  );
};
