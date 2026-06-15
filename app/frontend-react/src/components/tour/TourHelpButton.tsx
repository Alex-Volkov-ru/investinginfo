import { HelpCircle } from 'lucide-react';
import { useTour } from '../../contexts/TourContext';

interface TourHelpButtonProps {
  className?: string;
}

export function TourHelpButton({ className = '' }: TourHelpButtonProps) {
  const { startTour } = useTour();

  return (
    <button
      type="button"
      data-tour="tour-help-btn"
      onClick={() => startTour(true)}
      className={`p-2 rounded-lg text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/30 transition-colors ${className}`}
      title="Справка по разделу"
      aria-label="Справка по разделу"
    >
      <HelpCircle className="h-5 w-5" />
    </button>
  );
}
