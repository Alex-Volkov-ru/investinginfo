import { useState, useEffect } from 'react';
import { Plus, TrendingUp, TrendingDown, Search, X, Key, CheckCircle, Edit2, Trash2, ChevronRight, ChevronDown } from 'lucide-react';
import { portfolioService } from '../services/portfolioService';
import { userService } from '../services/userService';
import { Portfolio, PositionFull, Quote, ResolveItem } from '../types';
import toast from 'react-hot-toast';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { PortfolioCharts } from '../components/PortfolioCharts';
import { DatePicker } from '../components/DatePicker';
import { format } from 'date-fns';

const PortfolioPage = () => {
  const [portfolios, setPortfolios] = useState<Portfolio[]>([]);
  const [selectedPortfolio, setSelectedPortfolio] = useState<Portfolio | null>(null);
  const [positions, setPositions] = useState<PositionFull[]>([]);
  const [quotes, setQuotes] = useState<Record<string, Quote>>({});
  const [loading, setLoading] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newPortfolioTitle, setNewPortfolioTitle] = useState('');
  const [showAddPositionModal, setShowAddPositionModal] = useState(false);
  const [tickerSearch, setTickerSearch] = useState('');
  const [searchResults, setSearchResults] = useState<ResolveItem[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedInstrument, setSelectedInstrument] = useState<ResolveItem | null>(null);
  const [quantity, setQuantity] = useState('');
  const [avgPrice, setAvgPrice] = useState('');
  const [purchaseDate, setPurchaseDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [instrumentType, setInstrumentType] = useState<'share' | 'bond' | 'etf' | 'other'>('share');
  const [showTokenModal, setShowTokenModal] = useState(false);
  const [tinkoffToken, setTinkoffToken] = useState('');
  const [hasTinkoffToken, setHasTinkoffToken] = useState(false);
  const [loadingToken, setLoadingToken] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingPosition, setEditingPosition] = useState<PositionFull | null>(null);
  const [editQuantity, setEditQuantity] = useState('');
  const [editAvgPrice, setEditAvgPrice] = useState('');
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [confirmAction, setConfirmAction] = useState<(() => void) | null>(null);

  useEffect(() => {
    loadPortfolios();
    checkTinkoffToken();
  }, []);

  const checkTinkoffToken = async () => {
    try {
      const userInfo = await userService.getMe();
      setHasTinkoffToken(userInfo.has_tinkoff);
    } catch (error) {
      // Ошибка обработана в interceptor
    }
  };

  useEffect(() => {
    if (selectedPortfolio) {
      loadPositions(selectedPortfolio.id);
    }
  }, [selectedPortfolio]);

  const loadPortfolios = async () => {
    try {
      const data = await portfolioService.getPortfolios();
      setPortfolios(data);
      if (data.length > 0 && !selectedPortfolio) {
        setSelectedPortfolio(data[0]);
      }
    } catch (error) {
      // Ошибка обработана в interceptor
    }
  };

  const loadPositions = async (portfolioId: number) => {
    setLoading(true);
    try {
      // Загружаем позиции
      const positionsData = await portfolioService.getPositionsFull(portfolioId);
      setPositions(positionsData); // Показываем позиции сразу
      
      // Параллельно загружаем котировки (использует кэш Redis - быстро)
      const tickers = positionsData
        .map((p) => p.instrument?.ticker)
        .filter((t): t is string => !!t);
      
      if (tickers.length > 0) {
        // Загружаем котировки параллельно, не ждем их для отображения позиций
        portfolioService.getQuotesByTickers(tickers)
          .then((response) => {
            const quotesMap: Record<string, Quote> = {};
            response.results.forEach((quote) => {
              if (quote.figi) {
                quotesMap[quote.figi] = quote;
              }
            });
            setQuotes(quotesMap); // Обновляем котировки когда придут
          })
          .catch(() => {
            // Ошибка обработана в interceptor
          });
      }
    } catch (error) {
      // Ошибка обработана в interceptor
    } finally {
      setLoading(false); // Убираем индикатор загрузки сразу после позиций
    }
  };

  const handleCreatePortfolio = async () => {
    if (!newPortfolioTitle.trim()) {
      toast.error('Введите название портфеля');
      return;
    }

    try {
      const portfolio = await portfolioService.createPortfolio({
        title: newPortfolioTitle,
      });
      setPortfolios([...portfolios, portfolio]);
      setSelectedPortfolio(portfolio);
      setNewPortfolioTitle('');
      setShowAddModal(false);
      toast.success('Портфель создан');
    } catch (error) {
      // Ошибка обработана в interceptor
    }
  };

  const handleSearchTicker = async () => {
    if (!tickerSearch.trim()) {
      toast.error('Введите тикер');
      return;
    }

    setSearching(true);
    try {
      const result = await portfolioService.resolveTicker(tickerSearch.trim());
      setSearchResults(result.results);
      if (result.results.length === 0) {
        toast.error('Инструмент не найден');
      }
    } catch (error) {
      toast.error('Ошибка поиска инструмента');
    } finally {
      setSearching(false);
    }
  };

  const handleAddPosition = async () => {
    if (!selectedPortfolio) {
      toast.error('Выберите портфель');
      return;
    }
    if (!selectedInstrument) {
      toast.error('Выберите инструмент');
      return;
    }
    if (!quantity || parseFloat(quantity) <= 0) {
      toast.error('Введите количество');
      return;
    }
    if (!avgPrice || parseFloat(avgPrice) <= 0) {
      toast.error('Введите среднюю цену');
      return;
    }

    try {
      // Определяем class_hint на основе выбранного типа или класса инструмента
      let classHint = instrumentType;
      if (instrumentType === 'other' && selectedInstrument.class) {
        classHint = selectedInstrument.class as 'share' | 'bond' | 'etf' | 'other';
      }

      await portfolioService.upsertPosition({
        portfolio_id: selectedPortfolio.id,
        ticker: tickerSearch.trim().toUpperCase(),
        figi: selectedInstrument.figi,
        class_hint: classHint,
        quantity: parseFloat(quantity),
        avg_price: parseFloat(avgPrice),
        name: selectedInstrument.name,
        currency: selectedInstrument.currency,
        nominal: selectedInstrument.nominal,
      });
      toast.success('Позиция добавлена');
      setShowAddPositionModal(false);
      setTickerSearch('');
      setSearchResults([]);
      setSelectedInstrument(null);
      setQuantity('');
      setAvgPrice('');
      setPurchaseDate(format(new Date(), 'yyyy-MM-dd'));
      setInstrumentType('share');
      if (selectedPortfolio) {
        loadPositions(selectedPortfolio.id);
      }
    } catch (error) {
      // Ошибка обработана в interceptor
    }
  };

  const handleSaveToken = async () => {
    if (!tinkoffToken.trim()) {
      toast.error('Введите токен');
      return;
    }

    setLoadingToken(true);
    try {
      await userService.updateTinkoffToken(tinkoffToken.trim());
      setHasTinkoffToken(true);
      setShowTokenModal(false);
      setTinkoffToken('');
      toast.success('Токен сохранен');
    } catch (error) {
      // Ошибка обработана в interceptor
    } finally {
      setLoadingToken(false);
    }
  };

  const handleRemoveToken = async () => {
    setLoadingToken(true);
    try {
      await userService.removeTinkoffToken();
      setHasTinkoffToken(false);
      toast.success('Токен удален');
    } catch (error) {
      // Ошибка обработана в interceptor
    } finally {
      setLoadingToken(false);
    }
  };

  const handleEditPosition = (position: PositionFull) => {
    setEditingPosition(position);
    setEditQuantity(position.quantity.toString());
    setEditAvgPrice(position.avg_price.toString());
    setShowEditModal(true);
  };

  const handleUpdatePosition = async () => {
    if (!editingPosition || !selectedPortfolio) {
      return;
    }
    if (!editQuantity || parseFloat(editQuantity) <= 0) {
      toast.error('Введите количество');
      return;
    }
    if (!editAvgPrice || parseFloat(editAvgPrice) <= 0) {
      toast.error('Введите среднюю цену');
      return;
    }

    try {
      // Для обновления используем разницу в количестве
      const deltaQty = parseFloat(editQuantity) - editingPosition.quantity;
      await portfolioService.upsertPosition({
        portfolio_id: selectedPortfolio.id,
        ticker: editingPosition.instrument?.ticker || '',
        figi: editingPosition.figi,
        class_hint: editingPosition.instrument?.class || 'other',
        quantity: deltaQty,
        avg_price: parseFloat(editAvgPrice),
        name: editingPosition.instrument?.name,
        currency: editingPosition.instrument?.currency,
        nominal: editingPosition.instrument?.nominal,
      });
      toast.success('Позиция обновлена');
      setShowEditModal(false);
      setEditingPosition(null);
      if (selectedPortfolio) {
        loadPositions(selectedPortfolio.id);
      }
    } catch (error) {
      // Ошибка обработана в interceptor
    }
  };

  const handleDeletePosition = (positionId: number) => {
    setConfirmAction(() => async () => {
      try {
        await portfolioService.deletePosition(positionId);
        toast.success('Позиция удалена');
        if (selectedPortfolio) {
          loadPositions(selectedPortfolio.id);
        }
      } catch (error) {
        // Ошибка обработана в interceptor
      } finally {
        setShowConfirmDialog(false);
      }
    });
    setShowConfirmDialog(true);
  };

  const calculateTotalValue = () => {
    return positions.reduce((sum, pos) => {
      const quote = quotes[pos.figi];
      const currentPrice = quote?.price || 0;
      const value = pos.quantity * currentPrice;
      return sum + value;
    }, 0);
  };

  const calculateTotalCost = () => {
    return positions.reduce((sum, pos) => {
      return sum + pos.quantity * pos.avg_price;
    }, 0);
  };

  const totalValue = calculateTotalValue();
  const totalCost = calculateTotalCost();
  const totalPnL = totalValue - totalCost;
  const totalPnLPercent = totalCost > 0 ? (totalPnL / totalCost) * 100 : 0;

  // Группировка позиций по типам
  const groupedPositions = {
    shares: positions.filter((p) => p.instrument?.class === 'share'),
    bonds: positions.filter((p) => p.instrument?.class === 'bond'),
    etfs: positions.filter((p) => p.instrument?.class === 'etf'),
    other: positions.filter((p) => !p.instrument?.class || !['share', 'bond', 'etf'].includes(p.instrument.class)),
  };

  // Расчет сумм по группам
  const calculateGroupValue = (group: PositionFull[]) => {
    return group.reduce((sum, pos) => {
      const quote = quotes[pos.figi];
      const currentPrice = quote?.price || 0;
      return sum + pos.quantity * currentPrice;
    }, 0);
  };

  const sharesValue = calculateGroupValue(groupedPositions.shares);
  const bondsValue = calculateGroupValue(groupedPositions.bonds);
  const etfsValue = calculateGroupValue(groupedPositions.etfs);

  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({
    shares: true,
    bonds: true,
    etfs: true,
    other: false,
  });

  const toggleGroup = (group: string) => {
    setExpandedGroups((prev) => ({ ...prev, [group]: !prev[group] }));
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Инвестиции</h1>
        <div className="flex space-x-3">
          <button
            onClick={() => setShowTokenModal(true)}
            className={`btn flex items-center ${
              hasTinkoffToken
                ? 'btn-secondary border-green-500 text-green-600 dark:text-green-400'
                : 'btn-secondary border-yellow-500 text-yellow-600 dark:text-yellow-400'
            }`}
            title={hasTinkoffToken ? 'Токен Тинькофф настроен' : 'Настроить токен Тинькофф'}
          >
            {hasTinkoffToken ? (
              <>
                <CheckCircle className="h-5 w-5 mr-2" />
                Токен
              </>
            ) : (
              <>
                <Key className="h-5 w-5 mr-2" />
                Токен
              </>
            )}
          </button>
          {selectedPortfolio && (
            <button
              onClick={() => setShowAddPositionModal(true)}
              className="btn btn-primary flex items-center"
            >
              <Plus className="h-5 w-5 mr-2" />
              Добавить позицию
            </button>
          )}
          <button
            onClick={() => setShowAddModal(true)}
            className="btn btn-secondary flex items-center"
          >
            <Plus className="h-5 w-5 mr-2" />
            Новый портфель
          </button>
        </div>
      </div>

      {/* Charts */}
      {selectedPortfolio && positions.length > 0 && (
        <PortfolioCharts
          positions={positions}
          quotes={quotes}
          totalValue={totalValue}
          totalPnL={totalPnL}
          totalPnLPercent={totalPnLPercent}
        />
      )}

      {/* Summary Cards - Compact Design */}
      <div className="mb-6">
        <div className="card p-4">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="text-center md:text-left">
              <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">ВСЕГО</div>
              <div className="text-lg font-bold text-gray-900 dark:text-gray-100">
                {totalValue.toLocaleString('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 })}
              </div>
            </div>
            <div className="text-center md:text-left">
              <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">АКЦИИ</div>
              <div className="text-lg font-bold text-gray-900 dark:text-gray-100">
                {sharesValue.toLocaleString('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 })}
              </div>
            </div>
            <div className="text-center md:text-left">
              <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">ОФЗ</div>
              <div className="text-lg font-bold text-gray-900 dark:text-gray-100">
                {bondsValue.toLocaleString('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 })}
              </div>
            </div>
            <div className="text-center md:text-left">
              <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">ФОНДЫ</div>
              <div className="text-lg font-bold text-gray-900 dark:text-gray-100">
                {etfsValue.toLocaleString('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 })}
              </div>
            </div>
            <div className="text-center md:text-left col-span-2 md:col-span-1 border-t md:border-t-0 md:border-l border-gray-200 dark:border-gray-700 pt-3 md:pt-0 md:pl-4">
              <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">P/L</div>
              <div className={`text-lg font-bold flex items-center justify-center md:justify-start ${
                totalPnL >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
              }`}>
                {totalPnL >= 0 ? (
                  <TrendingUp className="h-4 w-4 mr-1" />
                ) : (
                  <TrendingDown className="h-4 w-4 mr-1" />
                )}
                <span>{totalPnL.toLocaleString('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 })}</span>
                <span className="text-sm ml-1">({totalPnLPercent >= 0 ? '+' : ''}{totalPnLPercent.toFixed(2)}%)</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Portfolio Selector */}
      {portfolios.length > 0 && (
        <div className="card">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Выберите портфель
          </label>
          <select
            value={selectedPortfolio?.id || ''}
            onChange={(e) => {
              const portfolio = portfolios.find((p) => p.id === parseInt(e.target.value));
              setSelectedPortfolio(portfolio || null);
            }}
            className="input"
          >
            {portfolios.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Positions by Groups */}
      {selectedPortfolio && (
        <div className="card">
          <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-gray-100">ПОЗИЦИИ</h2>
          {loading ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">Загрузка...</div>
          ) : positions.length === 0 ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              Позиций пока нет. Добавьте первую позицию.
            </div>
          ) : (
            <div className="space-y-4">
              {/* Акции */}
              {groupedPositions.shares.length > 0 && (
                <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                  <button
                    onClick={() => toggleGroup('shares')}
                    className="w-full flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                  >
                    <div className="flex items-center">
                      {expandedGroups.shares ? (
                        <ChevronDown className="h-5 w-5 mr-2 text-gray-600 dark:text-gray-400" />
                      ) : (
                        <ChevronRight className="h-5 w-5 mr-2 text-gray-600 dark:text-gray-400" />
                      )}
                      <span className="font-semibold text-gray-900 dark:text-gray-100">Акции</span>
                    </div>
                    <span className="text-gray-700 dark:text-gray-300">
                      {sharesValue.toLocaleString('ru-RU', { style: 'currency', currency: 'RUB' })}
                    </span>
                  </button>
                  {expandedGroups.shares && (
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                        <thead className="bg-gray-50 dark:bg-gray-700">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Инструмент</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Кол-во</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Цена ср.</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Тек. цена</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Стоимость</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">P/L</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Действия</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                          {groupedPositions.shares.map((position) => {
                            const quote = quotes[position.figi];
                            const currentPrice = quote?.price || 0;
                            const value = position.quantity * currentPrice;
                            const cost = position.quantity * position.avg_price;
                            const pnl = value - cost;
                            const pnlPercent = cost > 0 ? (pnl / cost) * 100 : 0;
                            return (
                              <tr key={position.id}>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                                    {position.instrument?.ticker || position.figi}
                                  </div>
                                  <div className="text-sm text-gray-500 dark:text-gray-400">
                                    {position.instrument?.name || '-'}
                                  </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                                  {position.quantity.toLocaleString('ru-RU')}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                                  {position.avg_price.toLocaleString('ru-RU', { style: 'currency', currency: 'RUB' })}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                                  {currentPrice > 0 ? currentPrice.toLocaleString('ru-RU', { style: 'currency', currency: 'RUB' }) : '-'}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                                  {value.toLocaleString('ru-RU', { style: 'currency', currency: 'RUB' })}
                                </td>
                                <td className={`px-6 py-4 whitespace-nowrap text-sm font-medium ${
                                  pnl >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                                }`}>
                                  {pnl.toLocaleString('ru-RU', { style: 'currency', currency: 'RUB' })} ({pnlPercent.toFixed(2)}%)
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                  <div className="flex items-center space-x-2">
                                    <button onClick={() => handleEditPosition(position)} className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200" title="Редактировать">
                                      <Edit2 className="h-4 w-4" />
                                    </button>
                                    <button onClick={() => handleDeletePosition(position.id)} className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-200" title="Удалить">
                                      <Trash2 className="h-4 w-4" />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* ОФЗ/Облигации */}
              {groupedPositions.bonds.length > 0 && (
                <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                  <button
                    onClick={() => toggleGroup('bonds')}
                    className="w-full flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                  >
                    <div className="flex items-center">
                      {expandedGroups.bonds ? (
                        <ChevronDown className="h-5 w-5 mr-2 text-gray-600 dark:text-gray-400" />
                      ) : (
                        <ChevronRight className="h-5 w-5 mr-2 text-gray-600 dark:text-gray-400" />
                      )}
                      <span className="font-semibold text-gray-900 dark:text-gray-100">ОФЗ/Облигации</span>
                    </div>
                    <span className="text-gray-700 dark:text-gray-300">
                      {bondsValue.toLocaleString('ru-RU', { style: 'currency', currency: 'RUB' })}
                    </span>
                  </button>
                  {expandedGroups.bonds && (
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                        <thead className="bg-gray-50 dark:bg-gray-700">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Инструмент</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Кол-во</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Цена ср.</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Тек. цена</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Стоимость</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">P/L</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Действия</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                          {groupedPositions.bonds.map((position) => {
                            const quote = quotes[position.figi];
                            const currentPrice = quote?.price || 0;
                            const value = position.quantity * currentPrice;
                            const cost = position.quantity * position.avg_price;
                            const pnl = value - cost;
                            const pnlPercent = cost > 0 ? (pnl / cost) * 100 : 0;
                            return (
                              <tr key={position.id}>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                                    {position.instrument?.ticker || position.figi}
                                  </div>
                                  <div className="text-sm text-gray-500 dark:text-gray-400">
                                    {position.instrument?.name || '-'}
                                  </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                                  {position.quantity.toLocaleString('ru-RU')}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                                  {position.avg_price.toLocaleString('ru-RU', { style: 'currency', currency: 'RUB' })}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                                  {currentPrice > 0 ? currentPrice.toLocaleString('ru-RU', { style: 'currency', currency: 'RUB' }) : '-'}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                                  {value.toLocaleString('ru-RU', { style: 'currency', currency: 'RUB' })}
                                </td>
                                <td className={`px-6 py-4 whitespace-nowrap text-sm font-medium ${
                                  pnl >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                                }`}>
                                  {pnl.toLocaleString('ru-RU', { style: 'currency', currency: 'RUB' })} ({pnlPercent.toFixed(2)}%)
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                  <div className="flex items-center space-x-2">
                                    <button onClick={() => handleEditPosition(position)} className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200" title="Редактировать">
                                      <Edit2 className="h-4 w-4" />
                                    </button>
                                    <button onClick={() => handleDeletePosition(position.id)} className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-200" title="Удалить">
                                      <Trash2 className="h-4 w-4" />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* Фонды/ETF */}
              {groupedPositions.etfs.length > 0 && (
                <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                  <button
                    onClick={() => toggleGroup('etfs')}
                    className="w-full flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                  >
                    <div className="flex items-center">
                      {expandedGroups.etfs ? (
                        <ChevronDown className="h-5 w-5 mr-2 text-gray-600 dark:text-gray-400" />
                      ) : (
                        <ChevronRight className="h-5 w-5 mr-2 text-gray-600 dark:text-gray-400" />
                      )}
                      <span className="font-semibold text-gray-900 dark:text-gray-100">Фонды/ETF</span>
                    </div>
                    <span className="text-gray-700 dark:text-gray-300">
                      {etfsValue.toLocaleString('ru-RU', { style: 'currency', currency: 'RUB' })}
                    </span>
                  </button>
                  {expandedGroups.etfs && (
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                        <thead className="bg-gray-50 dark:bg-gray-700">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Инструмент</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Кол-во</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Цена ср.</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Тек. цена</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Стоимость</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">P/L</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Действия</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                          {groupedPositions.etfs.map((position) => {
                            const quote = quotes[position.figi];
                            const currentPrice = quote?.price || 0;
                            const value = position.quantity * currentPrice;
                            const cost = position.quantity * position.avg_price;
                            const pnl = value - cost;
                            const pnlPercent = cost > 0 ? (pnl / cost) * 100 : 0;
                            return (
                              <tr key={position.id}>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                                    {position.instrument?.ticker || position.figi}
                                  </div>
                                  <div className="text-sm text-gray-500 dark:text-gray-400">
                                    {position.instrument?.name || '-'}
                                  </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                                  {position.quantity.toLocaleString('ru-RU')}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                                  {position.avg_price.toLocaleString('ru-RU', { style: 'currency', currency: 'RUB' })}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                                  {currentPrice > 0 ? currentPrice.toLocaleString('ru-RU', { style: 'currency', currency: 'RUB' }) : '-'}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                                  {value.toLocaleString('ru-RU', { style: 'currency', currency: 'RUB' })}
                                </td>
                                <td className={`px-6 py-4 whitespace-nowrap text-sm font-medium ${
                                  pnl >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                                }`}>
                                  {pnl.toLocaleString('ru-RU', { style: 'currency', currency: 'RUB' })} ({pnlPercent.toFixed(2)}%)
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                  <div className="flex items-center space-x-2">
                                    <button onClick={() => handleEditPosition(position)} className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200" title="Редактировать">
                                      <Edit2 className="h-4 w-4" />
                                    </button>
                                    <button onClick={() => handleDeletePosition(position.id)} className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-200" title="Удалить">
                                      <Trash2 className="h-4 w-4" />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* Другое */}
              {groupedPositions.other.length > 0 && (
                <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                  <button
                    onClick={() => toggleGroup('other')}
                    className="w-full flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                  >
                    <div className="flex items-center">
                      {expandedGroups.other ? (
                        <ChevronDown className="h-5 w-5 mr-2 text-gray-600 dark:text-gray-400" />
                      ) : (
                        <ChevronRight className="h-5 w-5 mr-2 text-gray-600 dark:text-gray-400" />
                      )}
                      <span className="font-semibold text-gray-900 dark:text-gray-100">Другое</span>
                    </div>
                    <span className="text-gray-700 dark:text-gray-300">
                      {calculateGroupValue(groupedPositions.other).toLocaleString('ru-RU', { style: 'currency', currency: 'RUB' })}
                    </span>
                  </button>
                  {expandedGroups.other && (
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                        <thead className="bg-gray-50 dark:bg-gray-700">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Инструмент</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Кол-во</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Цена ср.</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Тек. цена</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Стоимость</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">P/L</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Действия</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                          {groupedPositions.other.map((position) => {
                            const quote = quotes[position.figi];
                            const currentPrice = quote?.price || 0;
                            const value = position.quantity * currentPrice;
                            const cost = position.quantity * position.avg_price;
                            const pnl = value - cost;
                            const pnlPercent = cost > 0 ? (pnl / cost) * 100 : 0;
                            return (
                              <tr key={position.id}>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                                    {position.instrument?.ticker || position.figi}
                                  </div>
                                  <div className="text-sm text-gray-500 dark:text-gray-400">
                                    {position.instrument?.name || '-'}
                                  </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                                  {position.quantity.toLocaleString('ru-RU')}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                                  {position.avg_price.toLocaleString('ru-RU', { style: 'currency', currency: 'RUB' })}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                                  {currentPrice > 0 ? currentPrice.toLocaleString('ru-RU', { style: 'currency', currency: 'RUB' }) : '-'}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                                  {value.toLocaleString('ru-RU', { style: 'currency', currency: 'RUB' })}
                                </td>
                                <td className={`px-6 py-4 whitespace-nowrap text-sm font-medium ${
                                  pnl >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                                }`}>
                                  {pnl.toLocaleString('ru-RU', { style: 'currency', currency: 'RUB' })} ({pnlPercent.toFixed(2)}%)
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                  <div className="flex items-center space-x-2">
                                    <button onClick={() => handleEditPosition(position)} className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200" title="Редактировать">
                                      <Edit2 className="h-4 w-4" />
                                    </button>
                                    <button onClick={() => handleDeletePosition(position.id)} className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-200" title="Удалить">
                                      <Trash2 className="h-4 w-4" />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Add Portfolio Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">Создать портфель</h3>
            <input
              type="text"
              placeholder="Название портфеля"
              value={newPortfolioTitle}
              onChange={(e) => setNewPortfolioTitle(e.target.value)}
              className="input mb-4"
              autoFocus
            />
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setNewPortfolioTitle('');
                }}
                className="btn btn-secondary"
              >
                Отмена
              </button>
              <button onClick={handleCreatePortfolio} className="btn btn-primary">
                Создать
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Position Modal */}
      {showAddPositionModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Добавить позицию</h3>
              <button
                onClick={() => {
                  setShowAddPositionModal(false);
                  setTickerSearch('');
                  setSearchResults([]);
                  setSelectedInstrument(null);
                  setQuantity('');
                  setAvgPrice('');
                  setPurchaseDate(format(new Date(), 'yyyy-MM-dd'));
                  setInstrumentType('share');
                }}
                className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Ticker Search */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Тикер (например, SBER, GAZP)
              </label>
              <div className="flex space-x-2">
                <input
                  type="text"
                  placeholder="Введите тикер"
                  value={tickerSearch}
                  onChange={(e) => setTickerSearch(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSearchTicker()}
                  className="input flex-1"
                  autoFocus
                />
                <button
                  onClick={handleSearchTicker}
                  disabled={searching}
                  className="btn btn-primary flex items-center"
                >
                  <Search className="h-4 w-4 mr-2" />
                  {searching ? 'Поиск...' : 'Найти'}
                </button>
              </div>
            </div>

            {/* Search Results */}
            {searchResults.length > 0 && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Выберите инструмент:
                </label>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {searchResults.map((item) => (
                    <button
                      key={item.figi}
                      onClick={() => setSelectedInstrument(item)}
                      className={`w-full text-left p-3 rounded-lg border transition-colors ${
                        selectedInstrument?.figi === item.figi
                          ? 'border-primary-500 bg-primary-50 dark:bg-primary-900'
                          : 'border-gray-300 dark:border-gray-600 hover:border-primary-300 dark:hover:border-primary-700'
                      }`}
                    >
                      <div className="font-medium text-gray-900 dark:text-gray-100">{item.name}</div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        {item.class} • {item.currency || 'RUB'} • FIGI: {item.figi}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Position Details */}
            {selectedInstrument && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Тип инструмента
                  </label>
                  <select
                    value={instrumentType}
                    onChange={(e) => setInstrumentType(e.target.value as 'share' | 'bond' | 'etf' | 'other')}
                    className="input"
                  >
                    <option value="share">Акции</option>
                    <option value="bond">Облигации</option>
                    <option value="etf">Фонды/ETF</option>
                    <option value="other">Другое</option>
                  </select>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    Выберите категорию для правильной группировки в портфеле
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Количество
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    className="input"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Средняя цена покупки
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0"
                    value={avgPrice}
                    onChange={(e) => setAvgPrice(e.target.value)}
                    className="input"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Дата покупки
                  </label>
                  <DatePicker
                    value={purchaseDate}
                    onChange={(value) => setPurchaseDate(value)}
                    placeholder="дд.мм.гггг"
                  />
                </div>
                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    onClick={() => {
                      setShowAddPositionModal(false);
                      setTickerSearch('');
                      setSearchResults([]);
                      setSelectedInstrument(null);
                      setQuantity('');
                      setAvgPrice('');
                      setPurchaseDate(format(new Date(), 'yyyy-MM-dd'));
                      setInstrumentType('share');
                    }}
                    className="btn btn-secondary"
                  >
                    Отмена
                  </button>
                  <button onClick={handleAddPosition} className="btn btn-primary">
                    Добавить
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Edit Position Modal */}
      {showEditModal && editingPosition && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Редактировать позицию</h3>
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setEditingPosition(null);
                }}
                className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Инструмент
                </label>
                <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <div className="font-medium text-gray-900 dark:text-gray-100">
                    {editingPosition.instrument?.ticker || editingPosition.figi}
                  </div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    {editingPosition.instrument?.name || '-'}
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Количество
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={editQuantity}
                  onChange={(e) => setEditQuantity(e.target.value)}
                  className="input"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Средняя цена покупки
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={editAvgPrice}
                  onChange={(e) => setEditAvgPrice(e.target.value)}
                  className="input"
                />
              </div>
              <div className="flex justify-end space-x-3 pt-4">
                <button
                  onClick={() => {
                    setShowEditModal(false);
                    setEditingPosition(null);
                  }}
                  className="btn btn-secondary"
                >
                  Отмена
                </button>
                <button onClick={handleUpdatePosition} className="btn btn-primary">
                  Сохранить
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tinkoff Token Modal */}
      {showTokenModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Токен Тинькофф
              </h3>
              <button
                onClick={() => {
                  setShowTokenModal(false);
                  setTinkoffToken('');
                }}
                className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {hasTinkoffToken ? (
              <div className="space-y-4">
                <div className="flex items-center space-x-2 text-green-600 dark:text-green-400">
                  <CheckCircle className="h-5 w-5" />
                  <span className="text-sm font-medium">Токен настроен</span>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Токен Тинькофф уже настроен. Вы можете обновить его или удалить.
                </p>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Новый токен (оставьте пустым, чтобы удалить текущий)
                  </label>
                  <input
                    type="text"
                    placeholder="t.xxxxxx"
                    value={tinkoffToken}
                    onChange={(e) => setTinkoffToken(e.target.value)}
                    className="input"
                  />
                </div>
                <div className="flex justify-end space-x-3">
                  <button
                    onClick={() => {
                      setShowTokenModal(false);
                      setTinkoffToken('');
                    }}
                    className="btn btn-secondary"
                  >
                    Отмена
                  </button>
                  {tinkoffToken.trim() ? (
                    <button
                      onClick={handleSaveToken}
                      disabled={loadingToken}
                      className="btn btn-primary"
                    >
                      {loadingToken ? 'Сохранение...' : 'Обновить'}
                    </button>
                  ) : (
                    <button
                      onClick={handleRemoveToken}
                      disabled={loadingToken}
                      className="btn btn-danger"
                    >
                      {loadingToken ? 'Удаление...' : 'Удалить токен'}
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Для работы с котировками и инструментами необходимо указать токен Тинькофф API.
                  Токен можно получить в личном кабинете Тинькофф Инвестиций.
                </p>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Токен Тинькофф
                  </label>
                  <input
                    type="text"
                    placeholder="t.xxxxxx"
                    value={tinkoffToken}
                    onChange={(e) => setTinkoffToken(e.target.value)}
                    className="input"
                    autoFocus
                  />
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    Можно ввести позже в личном кабинете.
                  </p>
                </div>
                <div className="flex justify-end space-x-3">
                  <button
                    onClick={() => {
                      setShowTokenModal(false);
                      setTinkoffToken('');
                    }}
                    className="btn btn-secondary"
                  >
                    Отмена
                  </button>
                  <button
                    onClick={handleSaveToken}
                    disabled={loadingToken || !tinkoffToken.trim()}
                    className="btn btn-primary"
                  >
                    {loadingToken ? 'Сохранение...' : 'Сохранить'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Confirm Delete Dialog */}
      <ConfirmDialog
        isOpen={showConfirmDialog}
        onCancel={() => setShowConfirmDialog(false)}
        onConfirm={() => {
          if (confirmAction) {
            confirmAction();
          }
        }}
        title="Удаление позиции"
        message="Вы уверены, что хотите удалить эту позицию?"
        confirmText="Удалить"
        cancelText="Отмена"
      />
    </div>
  );
};

export default PortfolioPage;

