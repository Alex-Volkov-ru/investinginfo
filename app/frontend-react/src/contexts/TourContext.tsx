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
import { useTheme } from './ThemeContext';
import { resolveLayoutTour, resolveTour, AppTourDefinition } from '../lib/tour/definitions';
import { dismissTour, isTourDismissed, LAYOUT_TOUR_ID } from '../lib/tour/storage';

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
  const { theme } = useTheme();
  const { user, isAuthenticated, isInitializing } = useAuth();
  const driverRef = useRef<Driver | null>(null);
  const activeTourIdRef = useRef<string | null>(null);
  const pageAutoStartedRef = useRef<string | null>(null);
  const layoutAutoStartedRef = useRef(false);

  const destroyDriver = useCallback(() => {
    driverRef.current?.destroy();
    driverRef.current = null;
  }, []);

  const runTour = useCallback(
    (tour: AppTourDefinition, markDismissed: boolean, onDone?: () => void) => {
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

      const popoverClass = theme === 'dark' ? 'wt-tour-popover wt-tour-popover-dark' : 'wt-tour-popover';

      const driverObj = driver({
        showProgress: true,
        animate: true,
        smoothScroll: true,
        allowClose: true,
        overlayOpacity: theme === 'dark' ? 0.72 : 0.55,
        stagePadding: 10,
        stageRadius: 10,
        nextBtnText: 'Далее',
        prevBtnText: 'Назад',
        doneBtnText: 'Готово',
        progressText: '{{current}} из {{total}}',
        popoverClass,
        steps,
        onDestroyed: () => {
          const finishedId = activeTourIdRef.current;
          if (markDismissed && finishedId) {
            dismissTour(finishedId);
          }
          activeTourIdRef.current = null;
          driverRef.current = null;
          onDone?.();
        },
        onPopoverRender: (popover, { driver: drv }) => {
          const footer = popover.footerButtons;
          if (!footer || footer.querySelector('[data-tour-skip]')) return;

          const skipBtn = document.createElement('button');
          skipBtn.type = 'button';
          skipBtn.className = 'wt-tour-skip-btn';
          skipBtn.dataset.tourSkip = '1';
          skipBtn.textContent = 'Пропустить';
          skipBtn.addEventListener('click', () => {
            if (activeTourIdRef.current) dismissTour(activeTourIdRef.current);
            drv.destroy();
          });
          footer.insertBefore(skipBtn, footer.firstChild);
        },
      });

      driverRef.current = driverObj;
      driverObj.drive();
    },
    [destroyDriver, theme]
  );

  const startPageTour = useCallback(
    (force = false) => {
      if (isInitializing || location.pathname === '/login') return;

      const mobile = isMobilePath(location.pathname);
      const tour = resolveTour(location.pathname, mobile, Boolean(user?.is_staff));
      if (!tour || tour.steps.length === 0) return;
      if (!force && isTourDismissed(tour.id)) return;

      window.setTimeout(() => {
        const refreshed = resolveTour(location.pathname, mobile, Boolean(user?.is_staff));
        if (!refreshed || refreshed.steps.length === 0) return;
        runTour(refreshed, !force);
      }, force ? 200 : 400);
    },
    [isInitializing, location.pathname, user?.is_staff, runTour]
  );

  const startLayoutTour = useCallback(
    (force = false) => {
      if (isInitializing || !isAuthenticated) return false;
      if (!force && isTourDismissed(LAYOUT_TOUR_ID)) return false;

      const mobile = isMobilePath(location.pathname);
      const layout = resolveLayoutTour(mobile);
      if (!layout || layout.steps.length === 0) return false;

      runTour(layout, !force, () => {
        window.setTimeout(() => startPageTour(false), 300);
      });
      return true;
    },
    [isInitializing, isAuthenticated, location.pathname, runTour, startPageTour]
  );

  const startTour = useCallback(
    (force = false) => {
      startPageTour(force);
    },
    [startPageTour]
  );

  const skipTour = useCallback(() => {
    if (activeTourIdRef.current) dismissTour(activeTourIdRef.current);
    destroyDriver();
  }, [destroyDriver]);

  useEffect(() => {
    destroyDriver();
    pageAutoStartedRef.current = null;
  }, [location.pathname, destroyDriver]);

  useEffect(() => {
    if (isInitializing || !isAuthenticated || location.pathname === '/login') return;

    const key = `${location.pathname}`;
    if (pageAutoStartedRef.current === key && isTourDismissed(LAYOUT_TOUR_ID)) return;

    const timer = window.setTimeout(() => {
      if (!isTourDismissed(LAYOUT_TOUR_ID) && !layoutAutoStartedRef.current) {
        layoutAutoStartedRef.current = true;
        const started = startLayoutTour(false);
        if (started) {
          pageAutoStartedRef.current = key;
          return;
        }
      }

      const mobile = isMobilePath(location.pathname);
      const tour = resolveTour(location.pathname, mobile, Boolean(user?.is_staff));
      if (!tour || isTourDismissed(tour.id)) return;

      pageAutoStartedRef.current = key;
      startPageTour(false);
    }, 800);

    return () => window.clearTimeout(timer);
  }, [
    location.pathname,
    isAuthenticated,
    isInitializing,
    user?.is_staff,
    startLayoutTour,
    startPageTour,
  ]);

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
