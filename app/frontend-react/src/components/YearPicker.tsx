import React, { useState, useRef, useEffect } from 'react';
import { Calendar, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';

interface YearPickerProps {
  value: number;
  onChange: (year: number) => void;
  className?: string;
  minYear?: number;
  maxYear?: number;
}

export const YearPicker: React.FC<YearPickerProps> = ({
  value,
  onChange,
  className = '',
  minYear = 2020,
  maxYear = 2030,
}) => {
  const { theme } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState(value.toString());
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setInputValue(value.toString());
  }, [value]);

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

  const handleYearSelect = (year: number) => {
    if (year >= minYear && year <= maxYear) {
      onChange(year);
      setInputValue(year.toString());
      setIsOpen(false);
    }
  };

  const handleYearChange = (delta: number) => {
    const newYear = value + delta;
    if (newYear >= minYear && newYear <= maxYear) {
      onChange(newYear);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInputValue(val);
    
    const year = parseInt(val);
    if (!isNaN(year) && year >= minYear && year <= maxYear) {
      onChange(year);
    }
  };

  const handleInputBlur = () => {
    setInputValue(value.toString());
  };

  const handleToday = () => {
    const currentYear = new Date().getFullYear();
    if (currentYear >= minYear && currentYear <= maxYear) {
      handleYearSelect(currentYear);
    }
  };

  const handleClear = () => {
    const currentYear = new Date().getFullYear();
    handleYearSelect(currentYear);
  };

  // Генерируем годы для сетки
  const startYear = Math.max(minYear, value - 4);
  const endYear = Math.min(maxYear, value + 4);
  const years: number[] = [];
  for (let y = startYear; y <= endYear; y++) {
    years.push(y);
  }

  const currentYear = new Date().getFullYear();

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
          placeholder="Год"
          className="input pl-10 pr-10 w-32"
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
          } p-4 min-w-[200px]`}
        >
          {/* Year Navigation */}
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={() => handleYearChange(-1)}
              disabled={value <= minYear}
              className={`p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 ${
                theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
              } ${value <= minYear ? 'opacity-50 cursor-not-allowed' : ''}`}
              type="button"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              {value}
            </div>
            <button
              onClick={() => handleYearChange(1)}
              disabled={value >= maxYear}
              className={`p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 ${
                theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
              } ${value >= maxYear ? 'opacity-50 cursor-not-allowed' : ''}`}
              type="button"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>

          {/* Years Grid */}
          <div className="grid grid-cols-3 gap-2 mb-4">
            {years.map((year) => {
              const isSelected = year === value;
              const isCurrent = year === currentYear;
              
              return (
                <button
                  key={year}
                  onClick={() => handleYearSelect(year)}
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
                  type="button"
                >
                  {year}
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
              Текущий год
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

