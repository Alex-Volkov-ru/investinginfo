import { useCallback, useEffect, useMemo, useState } from 'react';
import { format, getDay, getDaysInMonth } from 'date-fns';
import { ru } from 'date-fns/locale';
import { X } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  adminService,
  CalendarPayment,
  ObligationRisk,
  ObligationSummaryItem,
  ObligationTemplate,
  CalendarHeatmap,
  ObligationRiskDetailed,
} from '../../services/adminService';
import { UserListItem } from '../../services/userService';
import { MonthYearPicker } from '../MonthYearPicker';
import { ConfirmDialog } from '../ConfirmDialog';
import {
  AdminDeleteBtn,
  AdminField,
  AdminFormRow,
  AdminHelpHint,
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

function monthYearValue(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}`;
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
  const [heatmap, setHeatmap] = useState<CalendarHeatmap | null>(null);
  const [risksDetailed, setRisksDetailed] = useState<ObligationRiskDetailed[]>([]);
  const [monthYear, setMonthYear] = useState(() => format(new Date(), 'yyyy-MM'));
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [dayEmailFilter, setDayEmailFilter] = useState('');
  const [confirmDialog, setConfirmDialog] = useState<{
    title: string;
    message: string;
    confirmText: string;
    confirmButtonClass?: string;
    onConfirm: () => void;
  } | null>(null);

  const [year, month] = useMemo(() => {
    const [y, m] = monthYear.split('-').map(Number);
    return [y, m];
  }, [monthYear]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [s, c, r, t, hm, rd] = await Promise.all([
        adminService.getObligationsSummary(),
        adminService.getObligationsCalendar(year, month),
        adminService.getObligationsRisks(),
        adminService.listObligationTemplates(),
        adminService.getObligationsHeatmap(year, month),
        adminService.getObligationsRisksDetailed(),
      ]);
      setSummary(s);
      setCalendar(c);
      setRisks(r);
      setTemplates(t);
      setHeatmap(hm);
      setRisksDetailed(rd);
    } finally {
      setLoading(false);
    }
  }, [year, month]);

  useEffect(() => {
    void load();
  }, [load]);

  const heatmapCells = useMemo(() => {
    if (!heatmap) return [];
    const monthStart = new Date(heatmap.year, heatmap.month - 1, 1);
    const offset = (getDay(monthStart) + 6) % 7;
    const daysInMonth = getDaysInMonth(monthStart);
    const dayMap = new Map(heatmap.days.map((d) => [d.day, d]));
    const cells: ({ kind: 'empty' } | { kind: 'day'; day: number; payment_count: number; total_amount: number })[] = [];
    for (let i = 0; i < offset; i += 1) cells.push({ kind: 'empty' });
    for (let day = 1; day <= daysInMonth; day += 1) {
      const stat = dayMap.get(day);
      cells.push({
        kind: 'day',
        day,
        payment_count: stat?.payment_count ?? 0,
        total_amount: stat?.total_amount ?? 0,
      });
    }
    return cells;
  }, [heatmap]);

  const summaryByBlockId = useMemo(
    () => new Map(summary.map((s) => [s.block_id, s])),
    [summary]
  );

  const dayPayments = useMemo(() => {
    if (!selectedDay || !heatmap) return [];
    const needle = dayEmailFilter.trim().toLowerCase();
    return calendar.filter((c) => {
      const d = new Date(c.date);
      const sameDay =
        d.getDate() === selectedDay &&
        d.getMonth() + 1 === heatmap.month &&
        d.getFullYear() === heatmap.year;
      if (!sameDay) return false;
      if (!needle) return true;
      return c.email.toLowerCase().includes(needle) || c.title.toLowerCase().includes(needle);
    });
  }, [selectedDay, calendar, heatmap, dayEmailFilter]);

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
    if (r.created === false) {
      toast(`У пользователя уже есть такой блок (#${r.block_id})`);
    } else {
      toast.success(`Блок создан #${r.block_id}`);
    }
    await load();
  };

  const onApplyAllTemplates = async () => {
    if (!applyUser) return;
    const r = await adminService.applyAllObligationTemplates(applyUser);
    toast.success(`Готово: создано ${r.created}, пропущено дублей ${r.reused}`);
    await load();
  };

  const onDismissRisk = (risk: ObligationRiskDetailed) => {
    setConfirmDialog({
      title: 'Скрыть из эскалации',
      message: `Убрать «${risk.title}» (${risk.email}) из списка эскалации? Обязательство пользователя не удаляется — только скрывается напоминание для админа.`,
      confirmText: 'Скрыть',
      confirmButtonClass: 'btn-primary',
      onConfirm: () => {
        void (async () => {
          try {
            await adminService.dismissObligationRisk({
              user_id: risk.user_id,
              kind: risk.kind,
              block_id: risk.block_id,
              obligation_id: risk.obligation_id,
            });
            toast.success('Скрыто из эскалации');
            await load();
          } catch {
            // interceptor
          } finally {
            setConfirmDialog(null);
          }
        })();
      },
    });
  };

  const onDeleteSummaryBlock = (item: ObligationSummaryItem) => {
    setConfirmDialog({
      title: 'Удалить обязательство пользователя',
      message: `ВНИМАНИЕ: будет безвозвратно удалён кредитный блок «${item.title}» у ${item.email} вместе с графиком платежей. Это действие нельзя отменить.`,
      confirmText: 'Удалить навсегда',
      confirmButtonClass: 'btn-danger',
      onConfirm: () => {
        void (async () => {
          try {
            await adminService.deleteObligationBlock(item.block_id);
            toast.success('Обязательство удалено');
            await load();
          } catch {
            // interceptor
          } finally {
            setConfirmDialog(null);
          }
        })();
      },
    });
  };

  if (loading) return <AdminLoading />;

  const severityLabel: Record<ObligationRiskDetailed['severity'], string> = {
    overdue: 'Просрочено',
    today: 'Сегодня',
    soon: 'Скоро',
    upcoming: 'Предстоит',
  };
  const severityClass: Record<ObligationRiskDetailed['severity'], string> = {
    overdue: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
    today: 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300',
    soon: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300',
    upcoming: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  };
  const maxHeat = heatmap ? Math.max(1, ...heatmap.days.map((d) => d.payment_count)) : 1;

  const weekdayLabels = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <MonthYearPicker value={monthYear} onChange={setMonthYear} />
        <button type="button" className="btn btn-secondary text-xs min-h-[44px]" onClick={() => void load()}>
          Обновить
        </button>
      </div>

      {risksDetailed.length > 0 && (
        <AdminSection title={`Эскалация рисков (${risksDetailed.length})`}>
          <AdminHelpHint>
            Кнопка «Скрыть» убирает запись только из списка эскалации для админа. Обязательство пользователя не удаляется.
            Чтобы удалить кредит полностью — используйте корзину в таблице обязательств ниже.
          </AdminHelpHint>
          <AdminTableWrap maxHeight="240px">
            <AdminTableHead>
              <tr>
                <th>Email</th>
                <th>Уровень</th>
                <th>Обязательство</th>
                <th className="hidden sm:table-cell">Сумма</th>
                <th>Срок</th>
                <th className="w-24">Действие</th>
              </tr>
            </AdminTableHead>
            <AdminTableBody>
              {risksDetailed.map((r, i) => (
                <tr key={`${r.user_id}-${r.kind}-${r.block_id ?? r.obligation_id ?? i}`}>
                  <td className="admin-cell-email">{r.email}</td>
                  <td>
                    <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ${severityClass[r.severity]}`}>
                      {severityLabel[r.severity]}
                    </span>
                  </td>
                  <td>
                    <div>{r.title}</div>
                    <div className="text-xs admin-cell-muted">{r.message}</div>
                  </td>
                  <td className="hidden sm:table-cell tabular-nums">{r.amount.toLocaleString('ru-RU')} ₽</td>
                  <td className="whitespace-nowrap text-xs">
                    {r.due_date ? format(new Date(r.due_date), 'dd.MM.yy') : '—'}
                    {r.days_until != null && r.severity !== 'overdue' && (
                      <span className="admin-cell-muted"> ({r.days_until}д)</span>
                    )}
                  </td>
                  <td>
                    <button
                      type="button"
                      className="text-xs text-primary-600 dark:text-primary-400 hover:underline min-h-[44px] px-2"
                      onClick={() => onDismissRisk(r)}
                    >
                      Скрыть
                    </button>
                  </td>
                </tr>
              ))}
            </AdminTableBody>
          </AdminTableWrap>
        </AdminSection>
      )}

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
            <th className="w-10" />
          </tr>
        </AdminTableHead>
        <AdminTableBody>
          {summary.length === 0 ? (
            <tr>
              <td colSpan={7} className="admin-table-empty">Нет обязательств</td>
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
                <td>
                  <AdminDeleteBtn onClick={() => onDeleteSummaryBlock(s)} />
                </td>
              </tr>
            ))
          )}
        </AdminTableBody>
      </AdminTableWrap>

      {heatmap && (
        <AdminSection
          title={`Календарь платежей — ${heatmap.month}.${heatmap.year}`}
          subtitle="Сводка по всем клиентам: когда и сколько платежей приходится на каждый день месяца"
        >
          <AdminHelpHint>
            <strong>Зачем:</strong> видно «пиковые» дни — когда у многих клиентов совпадают платежи (ипотека, кредиты).
            Синий цвет = есть платежи в этот день, цифра внизу = количество платежей. Нажмите на день — откроется детализация.
            <br />
            <strong>Прогноз 7д/30д</strong> — сумма предстоящих платежей по всем пользователям.
            <strong> Просрочено</strong> — блоки с просроченной датой. Действие: смотрите «Эскалация рисков» и связывайтесь с клиентом.
          </AdminHelpHint>
          <div className="px-4 pt-2 pb-2 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            <div>Прогноз 7д: <strong>{heatmap.forecast_7d.toLocaleString('ru-RU')} ₽</strong></div>
            <div>Прогноз 30д: <strong>{heatmap.forecast_30d.toLocaleString('ru-RU')} ₽</strong></div>
            <div className="text-red-600">Просрочено: <strong>{heatmap.overdue_count}</strong></div>
            <div>Скоро (3 дня): <strong>{heatmap.upcoming_count}</strong></div>
          </div>
          <div className="admin-heatmap-legend">
            <span>Число в ячейке — кол-во платежей в этот день. Нажмите на день для деталей.</span>
            <span className="inline-flex items-center gap-1">
              <span className="w-3 h-3 rounded" style={{ backgroundColor: 'rgba(59,130,246,0.5)' }} /> есть платежи
            </span>
          </div>
          <div className="grid grid-cols-7 gap-1 px-4 pb-4">
            {weekdayLabels.map((w) => (
              <div key={w} className="admin-heatmap-weekday">{w}</div>
            ))}
            {heatmapCells.map((cell, i) => {
              if (cell.kind === 'empty') {
                return <div key={`e-${i}`} className="admin-heatmap-day-empty" />;
              }
              const intensity = cell.payment_count / maxHeat;
              const clickable = cell.payment_count > 0;
              return (
                <button
                  key={cell.day}
                  type="button"
                  disabled={!clickable}
                  onClick={() => {
                    setDayEmailFilter('');
                    setSelectedDay(cell.day);
                  }}
                  title={`${cell.day} ${heatmap.month}.${heatmap.year}: ${cell.payment_count} плат., ${cell.total_amount.toLocaleString('ru-RU')} ₽`}
                  className={`admin-heatmap-day ${clickable ? 'admin-heatmap-day-clickable' : ''}`}
                  style={{
                    backgroundColor: cell.payment_count
                      ? `rgba(59, 130, 246, ${0.15 + intensity * 0.65})`
                      : undefined,
                  }}
                >
                  <span>{cell.day}</span>
                  {cell.payment_count > 0 && (
                    <span className="tabular-nums opacity-80 font-medium">{cell.payment_count}</span>
                  )}
                </button>
              );
            })}
          </div>
        </AdminSection>
      )}

      <AdminSection title={`Платежи за ${month}.${year}`}>
        {calendar.length === 0 ? (
          <div className="text-xs text-gray-500 px-4 pb-4">Нет платежей в этом месяце</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 text-xs px-4 pb-4">
            {calendar.map((c, i) => (
              <button
                key={`${c.user_id}-${c.date}-${c.title}-${i}`}
                type="button"
                onClick={() => {
                  const d = new Date(c.date);
                  setMonthYear(monthYearValue(d.getFullYear(), d.getMonth() + 1));
                  setDayEmailFilter('');
                  setSelectedDay(d.getDate());
                }}
                className="flex flex-col sm:flex-row sm:justify-between gap-0.5 bg-gray-50 dark:bg-gray-800 rounded px-2 py-2 text-left hover:ring-2 hover:ring-primary-400 transition-shadow"
              >
                <span className="break-words">
                  {format(new Date(c.date), 'dd.MM')} — {c.title} ({c.email})
                </span>
                <span className="shrink-0 tabular-nums">{c.amount.toLocaleString('ru-RU')} ₽</span>
              </button>
            ))}
          </div>
        )}
      </AdminSection>

      <AdminSection
        title="Шаблоны обязательств"
        subtitle="Заготовки кредитов/ипотеки — сами по себе клиенту не попадают"
      >
        <AdminHelpHint>
          <strong>Как применить:</strong> создайте шаблон (название, сумма, платёж/мес, день платежа) →
          внизу выберите шаблон и пользователя → «Создать обязательство».
          У клиента появится блок в его разделе «Обязательства» с этими параметрами — как если бы он сам его добавил.
          Если такой же шаблон уже применён, повторный блок не создаётся.
          Кнопка «Скопировать все шаблоны» применяет весь список сразу к выбранному пользователю.
        </AdminHelpHint>
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
          <AdminField label="День платежа">
            <input
              className={adminInputClass}
              type="number"
              min={1}
              max={31}
              value={newTpl.due_day}
              onChange={(e) => setNewTpl({ ...newTpl, due_day: e.target.value })}
            />
          </AdminField>
          <button type="button" className="btn btn-primary text-xs min-h-[44px] self-end" onClick={() => void onCreateTemplate()}>
            Добавить
          </button>
        </AdminFormRow>
        <div className="divide-y divide-gray-100 dark:divide-gray-800">
          {templates.map((t) => (
            <div key={t.id} className="flex flex-col sm:flex-row sm:justify-between gap-1 text-xs px-4 py-2">
              <span>
                {t.title} — {t.monthly.toLocaleString('ru-RU')} ₽/мес
                {t.total ? `, всего ${t.total.toLocaleString('ru-RU')} ₽` : ''}
                {t.due_day ? `, ${t.due_day}-е число` : ''}
              </span>
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
              Создать обязательство
            </button>
            <button type="button" className="btn btn-primary text-xs min-h-[44px] self-end" onClick={() => void onApplyAllTemplates()}>
              Скопировать все шаблоны
            </button>
          </AdminFormRow>
        )}
      </AdminSection>

      {selectedDay != null && heatmap && (
        <div
          className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/55 p-0 sm:p-4"
          onClick={() => setSelectedDay(null)}
        >
          <div
            className="bg-white dark:bg-gray-800 w-full sm:max-w-2xl rounded-t-2xl sm:rounded-xl shadow-xl flex flex-col max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="flex items-start justify-between gap-3 px-4 sm:px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  Платежи на {selectedDay} {format(new Date(heatmap.year, heatmap.month - 1, selectedDay), 'MMMM yyyy', { locale: ru })}
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                  {dayPayments.length} платеж(ей) ·{' '}
                  {dayPayments.reduce((s, p) => s + p.amount, 0).toLocaleString('ru-RU')} ₽
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedDay(null)}
                className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"
                aria-label="Закрыть"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar px-4 sm:px-6 py-3 space-y-3">
              <div className="sticky top-0 z-10 bg-white dark:bg-gray-800 pb-3">
                <input
                  type="search"
                  value={dayEmailFilter}
                  onChange={(e) => setDayEmailFilter(e.target.value)}
                  placeholder="Фильтр по email или названию..."
                  className={`${adminInputClass} w-full`}
                />
              </div>
              {dayPayments.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-8">Нет платежей в этот день</p>
              ) : (
                dayPayments.map((p, i) => {
                  const extra = p.block_id ? summaryByBlockId.get(p.block_id) : undefined;
                  return (
                    <div
                      key={`${p.user_id}-${p.date}-${p.title}-${i}`}
                      className="rounded-lg border border-gray-200 dark:border-gray-700 p-3 bg-gray-50/80 dark:bg-gray-900/40"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
                        <div>
                          <div className="font-semibold text-gray-900 dark:text-gray-100">{p.title}</div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">{p.email}</div>
                        </div>
                        <div className="text-right">
                          <div className="font-bold text-gray-900 dark:text-gray-100 tabular-nums">
                            {p.amount.toLocaleString('ru-RU')} ₽
                          </div>
                          <div className="text-xs text-gray-500">
                            {format(new Date(p.date), 'dd.MM.yyyy')}
                            {p.payment_number ? ` · платёж №${p.payment_number}` : ''}
                          </div>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                        <div>
                          <span className="text-gray-500">Тип: </span>
                          {p.kind === 'block' ? 'Кредит/ипотека' : 'Простое обязательство'}
                        </div>
                        {p.monthly != null && (
                          <div>
                            <span className="text-gray-500">Платёж/мес: </span>
                            {p.monthly.toLocaleString('ru-RU')} ₽
                          </div>
                        )}
                        {p.remaining != null && (
                          <div>
                            <span className="text-gray-500">Остаток: </span>
                            {p.remaining.toLocaleString('ru-RU')} ₽
                          </div>
                        )}
                        {p.rate != null && p.rate > 0 && (
                          <div>
                            <span className="text-gray-500">Ставка: </span>
                            {p.rate}%
                          </div>
                        )}
                        {(p.status || extra?.status) && (
                          <div>
                            <span className="text-gray-500">Статус: </span>
                            {p.status || extra?.status}
                          </div>
                        )}
                        {extra?.next_payment && (
                          <div>
                            <span className="text-gray-500">След. платёж: </span>
                            {format(new Date(extra.next_payment), 'dd.MM.yyyy')}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
            <div className="px-4 sm:px-6 py-4 border-t border-gray-200 dark:border-gray-700">
              <button type="button" className="btn btn-secondary w-full min-h-[44px]" onClick={() => setSelectedDay(null)}>
                Закрыть
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={!!confirmDialog}
        title={confirmDialog?.title ?? ''}
        message={confirmDialog?.message ?? ''}
        confirmText={confirmDialog?.confirmText}
        confirmButtonClass={confirmDialog?.confirmButtonClass}
        onConfirm={() => confirmDialog?.onConfirm()}
        onCancel={() => setConfirmDialog(null)}
      />
    </div>
  );
};
