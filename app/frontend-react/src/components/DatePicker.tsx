import React, { useState, useRef, useEffect } from 'react';
import { Calendar, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { format, parse, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, isToday } from 'date-fns';

interface DatePickerProps {
  value: string; // Format: "YYYY-MM-DD"
  onChange: (value: string) => void;
  className?: string;
  placeholder?: string;
}

const weekDays = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
const months = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
];

export const DatePicker: React.FC<DatePickerProps> = ({
  value,
  onChange,
  className = '',
  placeholder = 'дд.мм.гггг',
}) => {
  const { theme } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const [currentMonth, setCurrentMonth] = useState<Date>(() => {
    if (value) {
      const date = parse(value, 'yyyy-MM-dd', new Date());
      return isNaN(date.getTime()) ? new Date() : startOfMonth(date);
    }
    return startOfMonth(new Date());
  });
  const [inputValue, setInputValue] = useState(() => {
    if (value) {
      const date = parse(value, 'yyyy-MM-dd', new Date());
      if (!isNaN(date.getTime())) {
        return format(date, 'dd.MM.yyyy');
      }
    }
    return '';
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

  useEffect(() => {
    if (value) {
      const date = parse(value, 'yyyy-MM-dd', new Date());
      if (!isNaN(date.getTime())) {
        setInputValue(format(date, 'dd.MM.yyyy'));
        setCurrentMonth(startOfMonth(date));
      }
    }
  }, [value]);

  const handleDateSelect = (date: Date) => {
    const formatted = format(date, 'yyyy-MM-dd');
    onChange(formatted);
    setInputValue(format(date, 'dd.MM.yyyy'));
    setIsOpen(false);
  };

  const handleMonthChange = (delta: number) => {
    const newMonth = new Date(currentMonth);
    newMonth.setMonth(currentMonth.getMonth() + delta);
    setCurrentMonth(startOfMonth(newMonth));
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInputValue(val);
    
    // Парсим введенное значение (dd.MM.yyyy или dd/MM/yyyy)
    const cleaned = val.replace(/[^\d.]/g, '');
    const parts = cleaned.split('.');
    
    if (parts.length === 3) {
      const day = parseInt(parts[0]);
      const month = parseInt(parts[1]) - 1;
      const year = parseInt(parts[2]);
      
      if (!isNaN(day) && !isNaN(month) && !isNaN(year) && year >= 2000 && year <= 2100) {
        const date = new Date(year, month, day);
        if (date.getDate() === day && date.getMonth() === month && date.getFullYear() === year) {
          const formatted = format(date, 'yyyy-MM-dd');
          onChange(formatted);
          setCurrentMonth(startOfMonth(date));
        }
      }
    }
  };

  const handleInputBlur = () => {
    // Восстанавливаем правильный формат при потере фокуса
    if (value) {
      const date = parse(value, 'yyyy-MM-dd', new Date());
      if (!isNaN(date.getTime())) {
        setInputValue(format(date, 'dd.MM.yyyy'));
      }
    } else {
      setInputValue('');
    }
  };

  const handleToday = () => {
    const today = new Date();
    handleDateSelect(today);
  };

  const handleClear = () => {
    setInputValue('');
    onChange('');
    setIsOpen(false);
  };

  // Генерируем календарь для текущего месяца
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarStart = new Date(monthStart);
  // Начинаем с понедельника
  const dayOfWeek = calendarStart.getDay();
  const daysToSubtract = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  calendarStart.setDate(calendarStart.getDate() - daysToSubtract);
  
  const calendarEnd = new Date(monthEnd);
  const endDayOfWeek = calendarEnd.getDay();
  const daysToAdd = endDayOfWeek === 0 ? 0 : 7 - endDayOfWeek;
  calendarEnd.setDate(calendarEnd.getDate() + daysToAdd);

  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });
  const selectedDate = value ? parse(value, 'yyyy-MM-dd', new Date()) : null;

  return (
    <div className={`relative ${className}`}>
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onFocus={() => setIsOpen(true)}
          onBlur={handleInputBlur}
          placeholder={placeholder}
          className="input pl-10 pr-10"
        />
        <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
        {inputValue && (
          <button
            onClick={handleClear}
            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            type="button"
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
          {/* Month/Year Selector */}
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={() => handleMonthChange(-1)}
              className={`p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 ${
                theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
              }`}
              type="button"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              {months[currentMonth.getMonth()]} {currentMonth.getFullYear()}
            </div>
            <button
              onClick={() => handleMonthChange(1)}
              className={`p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 ${
                theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
              }`}
              type="button"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>

          {/* Week Days Header */}
          <div className="grid grid-cols-7 gap-1 mb-2">
            {weekDays.map((day) => (
              <div
                key={day}
                className={`text-center text-xs font-medium py-2 ${
                  theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                }`}
              >
                {day}
              </div>
            ))}
          </div>

          {/* Calendar Grid */}
          <div className="grid grid-cols-7 gap-1">
            {days.map((day, index) => {
              const isCurrentMonth = isSameMonth(day, currentMonth);
              const isSelected = selectedDate && isSameDay(day, selectedDate);
              const isTodayDate = isToday(day);
              
              return (
                <button
                  key={index}
                  onClick={() => handleDateSelect(day)}
                  className={`h-9 rounded text-sm transition-colors ${
                    !isCurrentMonth
                      ? `${
                          theme === 'dark' ? 'text-gray-600' : 'text-gray-300'
                        }`
                      : isSelected
                      ? 'bg-primary-600 text-white hover:bg-primary-700'
                      : isTodayDate
                      ? `${
                          theme === 'dark'
                            ? 'bg-primary-900/30 text-primary-300 border border-primary-600'
                            : 'bg-primary-100 text-primary-700 border border-primary-600'
                        } hover:bg-primary-200 dark:hover:bg-primary-900/50`
                      : `${
                          theme === 'dark'
                            ? 'text-gray-300 hover:bg-gray-700'
                            : 'text-gray-700 hover:bg-gray-100'
                        }`
                  }`}
                  type="button"
                >
                  {format(day, 'd')}
                </button>
              );
            })}
          </div>

          {/* Footer */}
          <div className="flex justify-between items-center pt-3 mt-3 border-t border-gray-200 dark:border-gray-700">
            <button
              onClick={() => setIsOpen(false)}
              className={`text-sm ${
                theme === 'dark' ? 'text-gray-400 hover:text-gray-300' : 'text-gray-600 hover:text-gray-800'
              }`}
              type="button"
            >
              Закрыть
            </button>
            <button
              onClick={handleToday}
              className={`text-sm font-medium ${
                theme === 'dark' ? 'text-primary-400 hover:text-primary-300' : 'text-primary-600 hover:text-primary-700'
              }`}
              type="button"
            >
              Сегодня
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

