import React, { useState, useRef, useEffect } from 'react';
import { Calendar, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';

interface MonthYearPickerProps {
  value: string; // Format: "YYYY-MM"
  onChange: (value: string) => void;
  className?: string;
}

const months = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
];

const monthsShort = [
  'янв', 'фев', 'мар', 'апр', 'май', 'июн',
  'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'
];

export const MonthYearPicker: React.FC<MonthYearPickerProps> = ({
  value,
  onChange,
  className = '',
}) => {
  const { theme } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const [selectedYear, setSelectedYear] = useState<number>(() => {
    const [year] = value.split('-');
    return parseInt(year) || new Date().getFullYear();
  });
  const [selectedMonth, setSelectedMonth] = useState<number>(() => {
    const [, month] = value.split('-');
    return parseInt(month) - 1 || new Date().getMonth();
  });
  const [inputValue, setInputValue] = useState(() => {
    if (!value) return '';
    const [year, month] = value.split('-');
    const monthNum = parseInt(month) - 1;
    return `${months[monthNum]} ${year}`;
  });
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const handleMonthSelect = (monthIndex: number) => {
    setSelectedMonth(monthIndex);
    const newValue = `${selectedYear}-${String(monthIndex + 1).padStart(2, '0')}`;
    onChange(newValue);
    setInputValue(`${months[monthIndex]} ${selectedYear}`);
    setIsOpen(false);
  };

  const handleYearChange = (delta: number) => {
    const newYear = selectedYear + delta;
    setSelectedYear(newYear);
    const newValue = `${newYear}-${String(selectedMonth + 1).padStart(2, '0')}`;
    onChange(newValue);
    setInputValue(`${months[selectedMonth]} ${newYear}`);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInputValue(val);
    
    // Парсим введенное значение
    const parts = val.trim().split(' ');
    if (parts.length >= 2) {
      const monthName = parts[0].toLowerCase();
      const yearStr = parts[parts.length - 1];
      const year = parseInt(yearStr);
      
      if (!isNaN(year) && year >= 2000 && year <= 2100) {
        const monthIndex = months.findIndex(m => m.toLowerCase().startsWith(monthName));
        if (monthIndex !== -1) {
          const newValue = `${year}-${String(monthIndex + 1).padStart(2, '0')}`;
          onChange(newValue);
          setSelectedYear(year);
          setSelectedMonth(monthIndex);
        }
      }
    }
  };

  const handleInputBlur = () => {
    // Восстанавливаем правильный формат при потере фокуса
    if (value) {
      const [year, month] = value.split('-');
      const monthNum = parseInt(month) - 1;
      setInputValue(`${months[monthNum]} ${year}`);
    }
  };

  const handleInputFocus = () => {
    setIsOpen(true);
  };

  const handleToday = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth();
    const newValue = `${year}-${String(month + 1).padStart(2, '0')}`;
    onChange(newValue);
    setSelectedYear(year);
    setSelectedMonth(month);
    setInputValue(`${months[month]} ${year}`);
    setIsOpen(false);
  };

  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth();

  return (
    <div className={`relative ${className}`}>
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onFocus={handleInputFocus}
          onBlur={handleInputBlur}
          placeholder="Месяц Год"
          className="input pl-10 pr-10 w-48"
        />
        <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
        {inputValue && (
          <button
            onClick={() => {
              setInputValue('');
              onChange('');
            }}
            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {isOpen && (
        <div
          ref={dropdownRef}
          className={`absolute top-full left-0 mt-2 z-[100] ${
            theme === 'dark' ? 'bg-gray-800' : 'bg-white'
          } rounded-lg shadow-xl border ${
            theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
          } p-4 min-w-[280px]`}
        >
          {/* Year Selector */}
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={() => handleYearChange(-1)}
              className={`p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 ${
                theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
              }`}
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              {selectedYear}
            </div>
            <button
              onClick={() => handleYearChange(1)}
              className={`p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 ${
                theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
              }`}
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>

          {/* Months Grid */}
          <div className="grid grid-cols-3 gap-2 mb-4">
            {monthsShort.map((month, index) => {
              const isSelected = index === selectedMonth;
              const isCurrent = selectedYear === currentYear && index === currentMonth;
              
              return (
                <button
                  key={index}
                  onClick={() => handleMonthSelect(index)}
                  className={`px-3 py-2 rounded text-sm font-medium transition-colors ${
                    isSelected
                      ? 'bg-primary-600 text-white'
                      : isCurrent
                      ? `bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 ${
                          theme === 'dark' ? 'hover:bg-primary-900/50' : 'hover:bg-primary-200'
                        }`
                      : `${
                          theme === 'dark'
                            ? 'text-gray-300 hover:bg-gray-700'
                            : 'text-gray-700 hover:bg-gray-100'
                        }`
                  }`}
                >
                  {month}
                </button>
              );
            })}
          </div>

          {/* Footer */}
          <div className="flex justify-between items-center pt-3 border-t border-gray-200 dark:border-gray-700">
            <button
              onClick={() => setIsOpen(false)}
              className={`text-sm ${
                theme === 'dark' ? 'text-gray-400 hover:text-gray-300' : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              Закрыть
            </button>
            <button
              onClick={handleToday}
              className={`text-sm font-medium ${
                theme === 'dark' ? 'text-primary-400 hover:text-primary-300' : 'text-primary-600 hover:text-primary-700'
              }`}
            >
              В этом месяце
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

