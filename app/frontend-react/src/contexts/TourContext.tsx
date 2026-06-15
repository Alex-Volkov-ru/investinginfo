import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  ReactNode,
} from 'react';
import { useLocation } from 'react-router-dom';
import { driver, DriveStep, Driver } from 'driver.js';
import 'driver.js/dist/driver.css';
import { useAuth } from './AuthContext';
import { resolveTour, AppTourDefinition } from '../lib/tour/definitions';
import { dismissTour, isTourDismissed } from '../lib/tour/storage';

interface TourContextType {
  startTour: (force?: boolean) => void;
  skipTour: () => void;
  currentTourId: string | null;
}

const TourContext = createContext<TourContextType | undefined>(undefined);

const isMobilePath = (pathname: string) =>
  pathname.includes('_mobile') || pathname === '/mobile';

export const TourProvider = ({ children }: { children: ReactNode }) => {
  const location = useLocation();
  const { user, isAuthenticated, isInitializing } = useAuth();
  const driverRef = useRef<Driver | null>(null);
  const activeTourIdRef = useRef<string | null>(null);
  const autoStartedRef = useRef<string | null>(null);

  const destroyDriver = useCallback(() => {
    driverRef.current?.destroy();
    driverRef.current = null;
  }, []);

  const runTour = useCallback(
    (tour: AppTourDefinition, markDismissed: boolean) => {
      destroyDriver();
      activeTourIdRef.current = tour.id;

      const steps: DriveStep[] = tour.steps.map((step) => ({
        element: step.element,
        popover: {
          title: step.title,
          description: step.description,
          side: step.side,
        },
      }));

      const driverObj = driver({
        showProgress: true,
        animate: true,
        smoothScroll: true,
        allowClose: true,
        overlayOpacity: 0.55,
        stagePadding: 10,
        stageRadius: 10,
        nextBtnText: 'Далее',
        prevBtnText: 'Назад',
        doneBtnText: 'Готово',
        progressText: '{{current}} из {{total}}',
        popoverClass: 'wt-tour-popover',
        steps,
        onDestroyStarted: () => {
          if (markDismissed && activeTourIdRef.current) {
            dismissTour(activeTourIdRef.current);
          }
          activeTourIdRef.current = null;
        },
        onPopoverRender: (popover) => {
          const footer = popover.footerButtons;
          if (!footer || footer.querySelector('[data-tour-skip]')) return;

          const skipBtn = document.createElement('button');
          skipBtn.type = 'button';
          skipBtn.className = 'wt-tour-skip-btn';
          skipBtn.dataset.tourSkip = '1';
          skipBtn.textContent = 'Пропустить';
          skipBtn.addEventListener('click', () => {
            if (activeTourIdRef.current) dismissTour(activeTourIdRef.current);
            driverObj.destroy();
          });
          footer.insertBefore(skipBtn, footer.firstChild);
        },
      });

      driverRef.current = driverObj;
      driverObj.drive();
    },
    [destroyDriver]
  );

  const startTour = useCallback(
    (force = false) => {
      if (isInitializing) return;

      const mobile = isMobilePath(location.pathname);
      const tour = resolveTour(location.pathname, mobile, Boolean(user?.is_staff));
      if (!tour || tour.steps.length === 0) return;

      if (!force && isTourDismissed(tour.id)) return;

      window.setTimeout(() => {
        const refreshed = resolveTour(location.pathname, mobile, Boolean(user?.is_staff));
        if (!refreshed || refreshed.steps.length === 0) return;
        runTour(refreshed, !force);
      }, force ? 200 : 600);
    },
    [isInitializing, location.pathname, user?.is_staff, runTour]
  );

  const skipTour = useCallback(() => {
    if (activeTourIdRef.current) dismissTour(activeTourIdRef.current);
    destroyDriver();
  }, [destroyDriver]);

  useEffect(() => {
    destroyDriver();
    autoStartedRef.current = null;
  }, [location.pathname, destroyDriver]);

  useEffect(() => {
    if (isInitializing || !isAuthenticated) return;
    if (location.pathname === '/login') return;

    const mobile = isMobilePath(location.pathname);
    const tour = resolveTour(location.pathname, mobile, Boolean(user?.is_staff));
    if (!tour || isTourDismissed(tour.id)) return;

    const key = `${location.pathname}:${tour.id}`;
    if (autoStartedRef.current === key) return;
    autoStartedRef.current = key;

    const timer = window.setTimeout(() => startTour(false), 800);
    return () => window.clearTimeout(timer);
  }, [location.pathname, isAuthenticated, isInitializing, user?.is_staff, startTour]);

  useEffect(() => () => destroyDriver(), [destroyDriver]);

  return (
    <TourContext.Provider
      value={{
        startTour,
        skipTour,
        currentTourId: activeTourIdRef.current,
      }}
    >
      {children}
    </TourContext.Provider>
  );
};

export const useTour = () => {
  const ctx = useContext(TourContext);
  if (!ctx) throw new Error('useTour must be used within TourProvider');
  return ctx;
};
