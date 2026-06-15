import { WhiteboardZone } from '../../types';

interface BoardZonesProps {
  zones: WhiteboardZone[];
  visible: boolean;
  gridMode: boolean;
}

export function BoardZones({ zones, visible, gridMode }: BoardZonesProps) {
  if (!visible || gridMode || zones.length === 0) return null;

  return (
    <>
      {zones.map((zone) => (
        <div
          key={zone.id}
          className="absolute rounded-2xl border-2 border-dashed pointer-events-none z-[5]"
          style={{
            left: zone.x,
            top: zone.y,
            width: zone.width,
            height: zone.height,
            borderColor: zone.color,
            backgroundColor: `${zone.color}18`,
          }}
        >
          <div
            className="absolute -top-3 left-3 px-2 py-0.5 rounded-md text-xs font-bold text-white shadow-sm"
            style={{ backgroundColor: zone.color }}
          >
            {zone.title}
          </div>
        </div>
      ))}
    </>
  );
}
