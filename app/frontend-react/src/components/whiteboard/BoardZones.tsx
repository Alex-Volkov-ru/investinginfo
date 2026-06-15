import { useEffect, useRef } from 'react';
import { Lock, Unlock } from 'lucide-react';
import { clampZoneSize, MIN_ZONE_HEIGHT, MIN_ZONE_WIDTH } from '../../lib/whiteboardUtils';
import { WhiteboardZone } from '../../types';

interface BoardZonesProps {
  zones: WhiteboardZone[];
  visible: boolean;
  gridMode: boolean;
  onUpdateZone: (id: string, patch: Partial<WhiteboardZone>) => void;
  onDragStart?: () => void;
}

export function BoardZones({ zones, visible, gridMode, onUpdateZone, onDragStart }: BoardZonesProps) {
  const dragRef = useRef<{ id: string; startX: number; startY: number; zoneX: number; zoneY: number } | null>(null);
  const resizeRef = useRef<{ id: string; startX: number; startY: number; startW: number; startH: number } | null>(null);

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      if (resizeRef.current) {
        const { id, startX, startY, startW, startH } = resizeRef.current;
        const size = clampZoneSize(startW + (e.clientX - startX), startH + (e.clientY - startY));
        onUpdateZone(id, size);
        return;
      }
      if (!dragRef.current) return;
      const { id, startX, startY, zoneX, zoneY } = dragRef.current;
      onUpdateZone(id, {
        x: Math.max(0, Math.round(zoneX + e.clientX - startX)),
        y: Math.max(0, Math.round(zoneY + e.clientY - startY)),
      });
    };

    const onUp = () => {
      dragRef.current = null;
      resizeRef.current = null;
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [onUpdateZone]);

  if (!visible || gridMode || zones.length === 0) return null;

  return (
    <>
      {zones.map((zone) => {
        const locked = Boolean(zone.locked);
        return (
          <div
            key={zone.id}
            className={`absolute rounded-2xl border-2 border-dashed z-[5] group/zone ${
              locked ? 'pointer-events-none opacity-90' : 'pointer-events-auto'
            }`}
            style={{
              left: zone.x,
              top: zone.y,
              width: zone.width,
              height: zone.height,
              borderColor: zone.color,
              backgroundColor: `${zone.color}30`,
              boxShadow: `inset 0 0 0 1px ${zone.color}40`,
            }}
            onPointerDown={(e) => {
              if (locked) return;
              if ((e.target as HTMLElement).closest('[data-zone-handle]')) return;
              e.preventDefault();
              onDragStart?.();
              dragRef.current = {
                id: zone.id,
                startX: e.clientX,
                startY: e.clientY,
                zoneX: zone.x,
                zoneY: zone.y,
              };
            }}
          >
            <div
              className="absolute -top-3 left-3 flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-bold text-white shadow-md pointer-events-auto"
              style={{ backgroundColor: zone.color }}
            >
              <span>{zone.title}</span>
              <button
                type="button"
                data-zone-handle
                className="p-0.5 rounded hover:bg-white/20"
                title={locked ? 'Зона зафиксирована' : 'Зафиксировать зону'}
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  onUpdateZone(zone.id, { locked: !locked });
                }}
              >
                {locked ? <Lock className="h-3 w-3" /> : <Unlock className="h-3 w-3 opacity-80" />}
              </button>
              {!locked && (
                <input
                  type="color"
                  data-zone-handle
                  value={zone.color}
                  onPointerDown={(e) => e.stopPropagation()}
                  onChange={(e) => onUpdateZone(zone.id, { color: e.target.value })}
                  className="w-4 h-4 rounded border-0 p-0 cursor-pointer bg-transparent"
                  title="Цвет зоны"
                />
              )}
            </div>

            {!locked && (
              <div
                data-zone-handle
                className="absolute bottom-0 right-0 w-5 h-5 cursor-se-resize flex items-end justify-end p-0.5 opacity-70 group-hover/zone:opacity-100"
                onPointerDown={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  onDragStart?.();
                  resizeRef.current = {
                    id: zone.id,
                    startX: e.clientX,
                    startY: e.clientY,
                    startW: zone.width ?? MIN_ZONE_WIDTH,
                    startH: zone.height ?? MIN_ZONE_HEIGHT,
                  };
                }}
              >
                <svg viewBox="0 0 10 10" className="w-3 h-3" style={{ color: zone.color }} aria-hidden>
                  <path d="M9 1v8H1" fill="none" stroke="currentColor" strokeWidth="1.5" />
                </svg>
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}
