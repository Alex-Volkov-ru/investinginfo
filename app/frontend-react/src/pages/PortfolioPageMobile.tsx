import { useState, useEffect } from 'react';
import { BootstrapIcon } from '../components/BootstrapIcon';
import 'bootstrap-icons/font/bootstrap-icons.css';
import { portfolioService } from '../services/portfolioService';
import { userService } from '../services/userService';
import { Portfolio, PositionFull, Quote, ResolveItem } from '../types';
import toast from 'react-hot-toast';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { PortfolioCharts } from '../components/PortfolioCharts';

const PortfolioPageMobile = () => {
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
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({
    shares: true,
    bonds: true,
    etfs: true,
    other: false,
  });

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
      const positionsData = await portfolioService.getPositionsFull(portfolioId);
      setPositions(positionsData);
      
      const tickers = positionsData
        .map((p) => p.instrument?.ticker)
        .filter((t): t is string => !!t);
      
      if (tickers.length > 0) {
        portfolioService.getQuotesByTickers(tickers)
          .then((response) => {
            const quotesMap: Record<string, Quote> = {};
            response.results.forEach((quote) => {
              if (quote.figi) {
                quotesMap[quote.figi] = quote;
              }
            });
            setQuotes(quotesMap);
          })
          .catch(() => {});
      }
    } catch (error) {
      // Ошибка обработана в interceptor
    } finally {
      setLoading(false);
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

  const groupedPositions = {
    shares: positions.filter((p) => p.instrument?.class === 'share'),
    bonds: positions.filter((p) => p.instrument?.class === 'bond'),
    etfs: positions.filter((p) => p.instrument?.class === 'etf'),
    other: positions.filter((p) => !p.instrument?.class || !['share', 'bond', 'etf'].includes(p.instrument.class)),
  };

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

  const toggleGroup = (group: string) => {
    setExpandedGroups((prev) => ({ ...prev, [group]: !prev[group] }));
  };

  return (
    <div className="px-4 py-4 space-y-4">
      {/* Header with Actions */}
      <div className="flex justify-between items-center">
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Инвестиции</h1>
        <div className="flex space-x-2">
          <button
            onClick={() => setShowTokenModal(true)}
            className={`min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg border ${
              hasTinkoffToken
                ? 'border-green-500 text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20'
                : 'border-yellow-500 text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/20'
            }`}
            title={hasTinkoffToken ? 'Токен Тинькофф настроен' : 'Настроить токен Тинькофф'}
          >
            <BootstrapIcon name={hasTinkoffToken ? 'check-circle-fill' : 'key-fill'} size={20} />
          </button>
          {selectedPortfolio && (
            <button
              onClick={() => setShowAddPositionModal(true)}
              className="min-w-[44px] min-h-[44px] flex items-center justify-center bg-primary-600 text-white rounded-lg active:bg-primary-700"
              title="Добавить позицию"
            >
              <BootstrapIcon name="plus-lg" size={20} />
            </button>
          )}
          <button
            onClick={() => setShowAddModal(true)}
            className="min-w-[44px] min-h-[44px] flex items-center justify-center bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg active:bg-gray-300 dark:active:bg-gray-600"
            title="Новый портфель"
          >
            <BootstrapIcon name="folder-plus" size={20} />
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

      {/* Summary Cards */}
      {selectedPortfolio && positions.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow">
          <div className="grid grid-cols-2 gap-3">
            <div className="text-center">
              <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">ВСЕГО</div>
              <div className="text-base font-bold text-gray-900 dark:text-gray-100">
                {totalValue.toLocaleString('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 })}
              </div>
            </div>
            <div className="text-center">
              <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">АКЦИИ</div>
              <div className="text-base font-bold text-gray-900 dark:text-gray-100">
                {sharesValue.toLocaleString('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 })}
              </div>
            </div>
            <div className="text-center">
              <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">ОФЗ</div>
              <div className="text-base font-bold text-gray-900 dark:text-gray-100">
                {bondsValue.toLocaleString('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 })}
              </div>
            </div>
            <div className="text-center">
              <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">ФОНДЫ</div>
              <div className="text-base font-bold text-gray-900 dark:text-gray-100">
                {etfsValue.toLocaleString('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 })}
              </div>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
            <div className="text-center">
              <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">P/L</div>
              <div className={`text-base font-bold flex items-center justify-center ${
                totalPnL >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
              }`}>
                <BootstrapIcon name={totalPnL >= 0 ? 'arrow-up' : 'arrow-down'} size={16} className="mr-1" />
                <span>{totalPnL.toLocaleString('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 })}</span>
                <span className="text-sm ml-1">({totalPnLPercent >= 0 ? '+' : ''}{totalPnLPercent.toFixed(2)}%)</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Portfolio Selector */}
      {portfolios.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Выберите портфель
          </label>
          <select
            value={selectedPortfolio?.id || ''}
            onChange={(e) => {
              const portfolio = portfolios.find((p) => p.id === parseInt(e.target.value));
              setSelectedPortfolio(portfolio || null);
            }}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
          >
            {portfolios.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Positions */}
      {selectedPortfolio && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
          <h2 className="text-lg font-semibold p-4 text-gray-900 dark:text-gray-100 border-b border-gray-200 dark:border-gray-700">ПОЗИЦИИ</h2>
          {loading ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">Загрузка...</div>
          ) : positions.length === 0 ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              Позиций пока нет. Добавьте первую позицию.
            </div>
          ) : (
            <div className="space-y-2 p-2">
              {/* Акции */}
              {groupedPositions.shares.length > 0 && (
                <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                  <button
                    onClick={() => toggleGroup('shares')}
                    className="w-full flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 active:bg-gray-100 dark:active:bg-gray-600"
                  >
                    <div className="flex items-center">
                      <BootstrapIcon name={expandedGroups.shares ? 'chevron-down' : 'chevron-right'} size={16} className="mr-2 text-gray-600 dark:text-gray-400" />
                      <span className="font-semibold text-gray-900 dark:text-gray-100">Акции</span>
                    </div>
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      {sharesValue.toLocaleString('ru-RU', { style: 'currency', currency: 'RUB' })}
                    </span>
                  </button>
                  {expandedGroups.shares && (
                    <div className="divide-y divide-gray-200 dark:divide-gray-700">
                      {groupedPositions.shares.map((position) => {
                        const quote = quotes[position.figi];
                        const currentPrice = quote?.price || 0;
                        const value = position.quantity * currentPrice;
                        const cost = position.quantity * position.avg_price;
                        const pnl = value - cost;
                        const pnlPercent = cost > 0 ? (pnl / cost) * 100 : 0;
                        return (
                          <div key={position.id} className="p-3">
                            <div className="flex justify-between items-start mb-2">
                              <div className="flex-1">
                                <div className="font-medium text-gray-900 dark:text-gray-100">
                                  {position.instrument?.ticker || position.figi}
                                </div>
                                <div className="text-xs text-gray-500 dark:text-gray-400">
                                  {position.instrument?.name || '-'}
                                </div>
                              </div>
                              <div className="flex space-x-2">
                                <button
                                  onClick={() => handleEditPosition(position)}
                                  className="min-w-[32px] min-h-[32px] flex items-center justify-center text-blue-600 dark:text-blue-400 active:bg-blue-50 dark:active:bg-blue-900/20 rounded"
                                  title="Редактировать"
                                >
                                  <BootstrapIcon name="pencil" size={16} />
                                </button>
                                <button
                                  onClick={() => handleDeletePosition(position.id)}
                                  className="min-w-[32px] min-h-[32px] flex items-center justify-center text-red-600 dark:text-red-400 active:bg-red-50 dark:active:bg-red-900/20 rounded"
                                  title="Удалить"
                                >
                                  <BootstrapIcon name="trash" size={16} />
                                </button>
                              </div>
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-xs">
                              <div>
                                <span className="text-gray-500 dark:text-gray-400">Кол-во:</span>{' '}
                                <span className="text-gray-900 dark:text-gray-100">{position.quantity.toLocaleString('ru-RU')}</span>
                              </div>
                              <div>
                                <span className="text-gray-500 dark:text-gray-400">Цена ср.:</span>{' '}
                                <span className="text-gray-900 dark:text-gray-100">{position.avg_price.toLocaleString('ru-RU', { style: 'currency', currency: 'RUB' })}</span>
                              </div>
                              <div>
                                <span className="text-gray-500 dark:text-gray-400">Тек. цена:</span>{' '}
                                <span className="text-gray-900 dark:text-gray-100">{currentPrice > 0 ? currentPrice.toLocaleString('ru-RU', { style: 'currency', currency: 'RUB' }) : '-'}</span>
                              </div>
                              <div>
                                <span className="text-gray-500 dark:text-gray-400">Стоимость:</span>{' '}
                                <span className="text-gray-900 dark:text-gray-100">{value.toLocaleString('ru-RU', { style: 'currency', currency: 'RUB' })}</span>
                              </div>
                              <div className="col-span-2">
                                <span className="text-gray-500 dark:text-gray-400">P/L:</span>{' '}
                                <span className={`font-medium ${pnl >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                                  {pnl.toLocaleString('ru-RU', { style: 'currency', currency: 'RUB' })} ({pnlPercent.toFixed(2)}%)
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* ОФЗ/Облигации */}
              {groupedPositions.bonds.length > 0 && (
                <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                  <button
                    onClick={() => toggleGroup('bonds')}
                    className="w-full flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 active:bg-gray-100 dark:active:bg-gray-600"
                  >
                    <div className="flex items-center">
                      <BootstrapIcon name={expandedGroups.bonds ? 'chevron-down' : 'chevron-right'} size={16} className="mr-2 text-gray-600 dark:text-gray-400" />
                      <span className="font-semibold text-gray-900 dark:text-gray-100">ОФЗ/Облигации</span>
                    </div>
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      {bondsValue.toLocaleString('ru-RU', { style: 'currency', currency: 'RUB' })}
                    </span>
                  </button>
                  {expandedGroups.bonds && (
                    <div className="divide-y divide-gray-200 dark:divide-gray-700">
                      {groupedPositions.bonds.map((position) => {
                        const quote = quotes[position.figi];
                        const currentPrice = quote?.price || 0;
                        const value = position.quantity * currentPrice;
                        const cost = position.quantity * position.avg_price;
                        const pnl = value - cost;
                        const pnlPercent = cost > 0 ? (pnl / cost) * 100 : 0;
                        return (
                          <div key={position.id} className="p-3">
                            <div className="flex justify-between items-start mb-2">
                              <div className="flex-1">
                                <div className="font-medium text-gray-900 dark:text-gray-100">
                                  {position.instrument?.ticker || position.figi}
                                </div>
                                <div className="text-xs text-gray-500 dark:text-gray-400">
                                  {position.instrument?.name || '-'}
                                </div>
                              </div>
                              <div className="flex space-x-2">
                                <button
                                  onClick={() => handleEditPosition(position)}
                                  className="min-w-[32px] min-h-[32px] flex items-center justify-center text-blue-600 dark:text-blue-400 active:bg-blue-50 dark:active:bg-blue-900/20 rounded"
                                  title="Редактировать"
                                >
                                  <BootstrapIcon name="pencil" size={16} />
                                </button>
                                <button
                                  onClick={() => handleDeletePosition(position.id)}
                                  className="min-w-[32px] min-h-[32px] flex items-center justify-center text-red-600 dark:text-red-400 active:bg-red-50 dark:active:bg-red-900/20 rounded"
                                  title="Удалить"
                                >
                                  <BootstrapIcon name="trash" size={16} />
                                </button>
                              </div>
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-xs">
                              <div>
                                <span className="text-gray-500 dark:text-gray-400">Кол-во:</span>{' '}
                                <span className="text-gray-900 dark:text-gray-100">{position.quantity.toLocaleString('ru-RU')}</span>
                              </div>
                              <div>
                                <span className="text-gray-500 dark:text-gray-400">Цена ср.:</span>{' '}
                                <span className="text-gray-900 dark:text-gray-100">{position.avg_price.toLocaleString('ru-RU', { style: 'currency', currency: 'RUB' })}</span>
                              </div>
                              <div>
                                <span className="text-gray-500 dark:text-gray-400">Тек. цена:</span>{' '}
                                <span className="text-gray-900 dark:text-gray-100">{currentPrice > 0 ? currentPrice.toLocaleString('ru-RU', { style: 'currency', currency: 'RUB' }) : '-'}</span>
                              </div>
                              <div>
                                <span className="text-gray-500 dark:text-gray-400">Стоимость:</span>{' '}
                                <span className="text-gray-900 dark:text-gray-100">{value.toLocaleString('ru-RU', { style: 'currency', currency: 'RUB' })}</span>
                              </div>
                              <div className="col-span-2">
                                <span className="text-gray-500 dark:text-gray-400">P/L:</span>{' '}
                                <span className={`font-medium ${pnl >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                                  {pnl.toLocaleString('ru-RU', { style: 'currency', currency: 'RUB' })} ({pnlPercent.toFixed(2)}%)
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Фонды/ETF */}
              {groupedPositions.etfs.length > 0 && (
                <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                  <button
                    onClick={() => toggleGroup('etfs')}
                    className="w-full flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 active:bg-gray-100 dark:active:bg-gray-600"
                  >
                    <div className="flex items-center">
                      <BootstrapIcon name={expandedGroups.etfs ? 'chevron-down' : 'chevron-right'} size={16} className="mr-2 text-gray-600 dark:text-gray-400" />
                      <span className="font-semibold text-gray-900 dark:text-gray-100">Фонды/ETF</span>
                    </div>
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      {etfsValue.toLocaleString('ru-RU', { style: 'currency', currency: 'RUB' })}
                    </span>
                  </button>
                  {expandedGroups.etfs && (
                    <div className="divide-y divide-gray-200 dark:divide-gray-700">
                      {groupedPositions.etfs.map((position) => {
                        const quote = quotes[position.figi];
                        const currentPrice = quote?.price || 0;
                        const value = position.quantity * currentPrice;
                        const cost = position.quantity * position.avg_price;
                        const pnl = value - cost;
                        const pnlPercent = cost > 0 ? (pnl / cost) * 100 : 0;
                        return (
                          <div key={position.id} className="p-3">
                            <div className="flex justify-between items-start mb-2">
                              <div className="flex-1">
                                <div className="font-medium text-gray-900 dark:text-gray-100">
                                  {position.instrument?.ticker || position.figi}
                                </div>
                                <div className="text-xs text-gray-500 dark:text-gray-400">
                                  {position.instrument?.name || '-'}
                                </div>
                              </div>
                              <div className="flex space-x-2">
                                <button
                                  onClick={() => handleEditPosition(position)}
                                  className="min-w-[32px] min-h-[32px] flex items-center justify-center text-blue-600 dark:text-blue-400 active:bg-blue-50 dark:active:bg-blue-900/20 rounded"
                                  title="Редактировать"
                                >
                                  <BootstrapIcon name="pencil" size={16} />
                                </button>
                                <button
                                  onClick={() => handleDeletePosition(position.id)}
                                  className="min-w-[32px] min-h-[32px] flex items-center justify-center text-red-600 dark:text-red-400 active:bg-red-50 dark:active:bg-red-900/20 rounded"
                                  title="Удалить"
                                >
                                  <BootstrapIcon name="trash" size={16} />
                                </button>
                              </div>
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-xs">
                              <div>
                                <span className="text-gray-500 dark:text-gray-400">Кол-во:</span>{' '}
                                <span className="text-gray-900 dark:text-gray-100">{position.quantity.toLocaleString('ru-RU')}</span>
                              </div>
                              <div>
                                <span className="text-gray-500 dark:text-gray-400">Цена ср.:</span>{' '}
                                <span className="text-gray-900 dark:text-gray-100">{position.avg_price.toLocaleString('ru-RU', { style: 'currency', currency: 'RUB' })}</span>
                              </div>
                              <div>
                                <span className="text-gray-500 dark:text-gray-400">Тек. цена:</span>{' '}
                                <span className="text-gray-900 dark:text-gray-100">{currentPrice > 0 ? currentPrice.toLocaleString('ru-RU', { style: 'currency', currency: 'RUB' }) : '-'}</span>
                              </div>
                              <div>
                                <span className="text-gray-500 dark:text-gray-400">Стоимость:</span>{' '}
                                <span className="text-gray-900 dark:text-gray-100">{value.toLocaleString('ru-RU', { style: 'currency', currency: 'RUB' })}</span>
                              </div>
                              <div className="col-span-2">
                                <span className="text-gray-500 dark:text-gray-400">P/L:</span>{' '}
                                <span className={`font-medium ${pnl >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                                  {pnl.toLocaleString('ru-RU', { style: 'currency', currency: 'RUB' })} ({pnlPercent.toFixed(2)}%)
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Другое */}
              {groupedPositions.other.length > 0 && (
                <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                  <button
                    onClick={() => toggleGroup('other')}
                    className="w-full flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 active:bg-gray-100 dark:active:bg-gray-600"
                  >
                    <div className="flex items-center">
                      <BootstrapIcon name={expandedGroups.other ? 'chevron-down' : 'chevron-right'} size={16} className="mr-2 text-gray-600 dark:text-gray-400" />
                      <span className="font-semibold text-gray-900 dark:text-gray-100">Другое</span>
                    </div>
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      {calculateGroupValue(groupedPositions.other).toLocaleString('ru-RU', { style: 'currency', currency: 'RUB' })}
                    </span>
                  </button>
                  {expandedGroups.other && (
                    <div className="divide-y divide-gray-200 dark:divide-gray-700">
                      {groupedPositions.other.map((position) => {
                        const quote = quotes[position.figi];
                        const currentPrice = quote?.price || 0;
                        const value = position.quantity * currentPrice;
                        const cost = position.quantity * position.avg_price;
                        const pnl = value - cost;
                        const pnlPercent = cost > 0 ? (pnl / cost) * 100 : 0;
                        return (
                          <div key={position.id} className="p-3">
                            <div className="flex justify-between items-start mb-2">
                              <div className="flex-1">
                                <div className="font-medium text-gray-900 dark:text-gray-100">
                                  {position.instrument?.ticker || position.figi}
                                </div>
                                <div className="text-xs text-gray-500 dark:text-gray-400">
                                  {position.instrument?.name || '-'}
                                </div>
                              </div>
                              <div className="flex space-x-2">
                                <button
                                  onClick={() => handleEditPosition(position)}
                                  className="min-w-[32px] min-h-[32px] flex items-center justify-center text-blue-600 dark:text-blue-400 active:bg-blue-50 dark:active:bg-blue-900/20 rounded"
                                  title="Редактировать"
                                >
                                  <BootstrapIcon name="pencil" size={16} />
                                </button>
                                <button
                                  onClick={() => handleDeletePosition(position.id)}
                                  className="min-w-[32px] min-h-[32px] flex items-center justify-center text-red-600 dark:text-red-400 active:bg-red-50 dark:active:bg-red-900/20 rounded"
                                  title="Удалить"
                                >
                                  <BootstrapIcon name="trash" size={16} />
                                </button>
                              </div>
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-xs">
                              <div>
                                <span className="text-gray-500 dark:text-gray-400">Кол-во:</span>{' '}
                                <span className="text-gray-900 dark:text-gray-100">{position.quantity.toLocaleString('ru-RU')}</span>
                              </div>
                              <div>
                                <span className="text-gray-500 dark:text-gray-400">Цена ср.:</span>{' '}
                                <span className="text-gray-900 dark:text-gray-100">{position.avg_price.toLocaleString('ru-RU', { style: 'currency', currency: 'RUB' })}</span>
                              </div>
                              <div>
                                <span className="text-gray-500 dark:text-gray-400">Тек. цена:</span>{' '}
                                <span className="text-gray-900 dark:text-gray-100">{currentPrice > 0 ? currentPrice.toLocaleString('ru-RU', { style: 'currency', currency: 'RUB' }) : '-'}</span>
                              </div>
                              <div>
                                <span className="text-gray-500 dark:text-gray-400">Стоимость:</span>{' '}
                                <span className="text-gray-900 dark:text-gray-100">{value.toLocaleString('ru-RU', { style: 'currency', currency: 'RUB' })}</span>
                              </div>
                              <div className="col-span-2">
                                <span className="text-gray-500 dark:text-gray-400">P/L:</span>{' '}
                                <span className={`font-medium ${pnl >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                                  {pnl.toLocaleString('ru-RU', { style: 'currency', currency: 'RUB' })} ({pnlPercent.toFixed(2)}%)
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
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
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-end">
          <div className="bg-white dark:bg-gray-800 w-full rounded-t-xl p-4 pb-safe-bottom">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Создать портфель</h3>
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setNewPortfolioTitle('');
                }}
                className="min-w-[44px] min-h-[44px] flex items-center justify-center text-gray-500 dark:text-gray-400 active:bg-gray-100 dark:active:bg-gray-700 rounded-lg"
              >
                <BootstrapIcon name="x-lg" size={20} />
              </button>
            </div>
            <input
              type="text"
              placeholder="Название портфеля"
              value={newPortfolioTitle}
              onChange={(e) => setNewPortfolioTitle(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 mb-4"
              autoFocus
            />
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setNewPortfolioTitle('');
                }}
                className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg active:bg-gray-300 dark:active:bg-gray-600 min-h-[44px]"
              >
                Отмена
              </button>
              <button
                onClick={handleCreatePortfolio}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg active:bg-primary-700 min-h-[44px]"
              >
                Создать
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Position Modal - будет очень большой, поэтому я создам упрощенную версию */}
      {showAddPositionModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-end">
          <div className="bg-white dark:bg-gray-800 w-full rounded-t-xl p-4 pb-safe-bottom max-h-[90vh] overflow-y-auto">
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
      setInstrumentType('share');
                }}
                className="min-w-[44px] min-h-[44px] flex items-center justify-center text-gray-500 dark:text-gray-400 active:bg-gray-100 dark:active:bg-gray-700 rounded-lg"
              >
                <BootstrapIcon name="x-lg" size={20} />
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
                  className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  autoFocus
                />
                <button
                  onClick={handleSearchTicker}
                  disabled={searching}
                  className="px-4 py-2 bg-primary-600 text-white rounded-lg active:bg-primary-700 min-h-[44px] disabled:opacity-50"
                >
                  <BootstrapIcon name="search" size={20} />
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
                          : 'border-gray-300 dark:border-gray-600 active:border-primary-300 dark:active:border-primary-700'
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
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  >
                    <option value="share">Акции</option>
                    <option value="bond">Облигации</option>
                    <option value="etf">Фонды/ETF</option>
                    <option value="other">Другое</option>
                  </select>
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
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
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
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
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
      setInstrumentType('share');
                    }}
                    className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg active:bg-gray-300 dark:active:bg-gray-600 min-h-[44px]"
                  >
                    Отмена
                  </button>
                  <button
                    onClick={handleAddPosition}
                    className="px-4 py-2 bg-primary-600 text-white rounded-lg active:bg-primary-700 min-h-[44px]"
                  >
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
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-end">
          <div className="bg-white dark:bg-gray-800 w-full rounded-t-xl p-4 pb-safe-bottom">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Редактировать позицию</h3>
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setEditingPosition(null);
                }}
                className="min-w-[44px] min-h-[44px] flex items-center justify-center text-gray-500 dark:text-gray-400 active:bg-gray-100 dark:active:bg-gray-700 rounded-lg"
              >
                <BootstrapIcon name="x-lg" size={20} />
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
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
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
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                />
              </div>
              <div className="flex justify-end space-x-3 pt-4">
                <button
                  onClick={() => {
                    setShowEditModal(false);
                    setEditingPosition(null);
                  }}
                  className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg active:bg-gray-300 dark:active:bg-gray-600 min-h-[44px]"
                >
                  Отмена
                </button>
                <button
                  onClick={handleUpdatePosition}
                  className="px-4 py-2 bg-primary-600 text-white rounded-lg active:bg-primary-700 min-h-[44px]"
                >
                  Сохранить
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tinkoff Token Modal */}
      {showTokenModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-end">
          <div className="bg-white dark:bg-gray-800 w-full rounded-t-xl p-4 pb-safe-bottom">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Токен Тинькофф</h3>
              <button
                onClick={() => {
                  setShowTokenModal(false);
                  setTinkoffToken('');
                }}
                className="min-w-[44px] min-h-[44px] flex items-center justify-center text-gray-500 dark:text-gray-400 active:bg-gray-100 dark:active:bg-gray-700 rounded-lg"
              >
                <BootstrapIcon name="x-lg" size={20} />
              </button>
            </div>

            {hasTinkoffToken ? (
              <div className="space-y-4">
                <div className="flex items-center space-x-2 text-green-600 dark:text-green-400">
                  <BootstrapIcon name="check-circle-fill" size={20} />
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
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  />
                </div>
                <div className="flex justify-end space-x-3">
                  <button
                    onClick={() => {
                      setShowTokenModal(false);
                      setTinkoffToken('');
                    }}
                    className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg active:bg-gray-300 dark:active:bg-gray-600 min-h-[44px]"
                  >
                    Отмена
                  </button>
                  {tinkoffToken.trim() ? (
                    <button
                      onClick={handleSaveToken}
                      disabled={loadingToken}
                      className="px-4 py-2 bg-primary-600 text-white rounded-lg active:bg-primary-700 min-h-[44px] disabled:opacity-50"
                    >
                      {loadingToken ? 'Сохранение...' : 'Обновить'}
                    </button>
                  ) : (
                    <button
                      onClick={handleRemoveToken}
                      disabled={loadingToken}
                      className="px-4 py-2 bg-red-600 text-white rounded-lg active:bg-red-700 min-h-[44px] disabled:opacity-50"
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
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    autoFocus
                  />
                </div>
                <div className="flex justify-end space-x-3">
                  <button
                    onClick={() => {
                      setShowTokenModal(false);
                      setTinkoffToken('');
                    }}
                    className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg active:bg-gray-300 dark:active:bg-gray-600 min-h-[44px]"
                  >
                    Отмена
                  </button>
                  <button
                    onClick={handleSaveToken}
                    disabled={loadingToken || !tinkoffToken.trim()}
                    className="px-4 py-2 bg-primary-600 text-white rounded-lg active:bg-primary-700 min-h-[44px] disabled:opacity-50"
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

export default PortfolioPageMobile;
