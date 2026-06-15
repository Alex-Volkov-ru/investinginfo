import { useState } from 'react';
import { Calculator, ChevronDown, ChevronUp, Send } from 'lucide-react';

interface CalculatorWidgetProps {
  onSendToBoard: (amount: number) => void;
}

export function CalculatorWidget({ onSendToBoard }: CalculatorWidgetProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [display, setDisplay] = useState('0');
  const [prev, setPrev] = useState<number | null>(null);
  const [op, setOp] = useState<string | null>(null);
  const [fresh, setFresh] = useState(true);

  const current = () => parseFloat(display) || 0;

  const applyOp = (a: number, b: number, operator: string): number => {
    switch (operator) {
      case '+':
        return a + b;
      case '-':
        return a - b;
      case '*':
        return a * b;
      case '/':
        return b === 0 ? 0 : a / b;
      default:
        return b;
    }
  };

  const inputDigit = (digit: string) => {
    if (fresh) {
      setDisplay(digit === '.' ? '0.' : digit);
      setFresh(false);
      return;
    }
    if (digit === '.' && display.includes('.')) return;
    setDisplay(display === '0' && digit !== '.' ? digit : display + digit);
  };

  const clear = () => {
    setDisplay('0');
    setPrev(null);
    setOp(null);
    setFresh(true);
  };

  const chooseOp = (nextOp: string) => {
    if (op !== null && !fresh) {
      const result = applyOp(prev ?? 0, current(), op);
      setDisplay(String(Math.round(result * 100) / 100));
      setPrev(result);
    } else {
      setPrev(current());
    }
    setOp(nextOp);
    setFresh(true);
  };

  const equals = () => {
    if (op === null || prev === null) return;
    const result = applyOp(prev, current(), op);
    const rounded = Math.round(result * 100) / 100;
    setDisplay(String(rounded));
    setPrev(null);
    setOp(null);
    setFresh(true);
  };

  const buttons = [
    ['C', '±', '%', '/'],
    ['7', '8', '9', '*'],
    ['4', '5', '6', '-'],
    ['1', '2', '3', '+'],
    ['0', '.', '='],
  ];

  const handleBtn = (label: string) => {
    if (label === 'C') clear();
    else if (label === '=') equals();
    else if (['+', '-', '*', '/'].includes(label)) chooseOp(label);
    else if (label === '±') setDisplay(String(-current()));
    else if (label === '%') setDisplay(String(current() / 100));
    else inputDigit(label);
  };

  const resultValue = Math.max(0, Math.round(current() * 100) / 100);

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white/95 dark:bg-gray-900/95 backdrop-blur-md shadow-lg overflow-hidden w-full sm:w-56" data-tour="whiteboard-calculator">
      <button
        type="button"
        className="w-full flex items-center justify-between px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
        onClick={() => setCollapsed((v) => !v)}
      >
        <span className="flex items-center gap-2">
          <Calculator className="h-4 w-4" />
          Калькулятор
        </span>
        {collapsed ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>

      {!collapsed && (
        <div className="px-3 pb-3 border-t border-gray-100 dark:border-gray-800">
          <div className="text-right text-2xl font-mono font-semibold py-2 px-2 bg-gray-50 dark:bg-gray-800 rounded-lg my-2 tabular-nums truncate">
            {display}
          </div>
          <div className="grid grid-cols-4 gap-1.5">
            {buttons.flat().map((label, i) => (
              <button
                key={`${label}-${i}`}
                type="button"
                onClick={() => handleBtn(label)}
                className={`
                  rounded-lg py-2.5 text-sm font-medium transition-colors min-h-[44px]
                  ${label === '0' ? 'col-span-2' : ''}
                  ${['+', '-', '*', '/', '='].includes(label)
                    ? 'bg-primary-100 dark:bg-primary-900/50 text-primary-700 dark:text-primary-300 hover:bg-primary-200 dark:hover:bg-primary-900'
                    : label === 'C'
                      ? 'bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-100'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700'}
                `}
              >
                {label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => onSendToBoard(resultValue)}
            className="btn btn-primary w-full mt-2 text-sm flex items-center justify-center gap-2"
          >
            <Send className="h-4 w-4" />
            На доску
          </button>
        </div>
      )}
    </div>
  );
}
