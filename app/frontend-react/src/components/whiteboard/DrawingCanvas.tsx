import { useCallback, useEffect, useRef, useState } from 'react';
import { Eraser, Paintbrush, Trash2 } from 'lucide-react';

interface DrawingCanvasProps {
  enabled: boolean;
  canvasData: string | null;
  onChange: (data: string | null) => void;
}

export function DrawingCanvas({ enabled, canvasData, onChange }: DrawingCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const drawingRef = useRef(false);
  const [tool, setTool] = useState<'brush' | 'eraser'>('brush');
  const [brushSize, setBrushSize] = useState(3);
  const isDark = typeof document !== 'undefined' && document.documentElement.classList.contains('dark');
  const strokeColor = isDark ? '#e5e7eb' : '#1f2937';

  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const rect = container.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (canvasData) {
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0, rect.width, rect.height);
      };
      img.src = canvasData;
    }
  }, [canvasData]);

  useEffect(() => {
    if (!enabled) return;
    resizeCanvas();
    const observer = new ResizeObserver(resizeCanvas);
    if (containerRef.current) observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [enabled, resizeCanvas]);

  const getPos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const exportCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    try {
      onChange(canvas.toDataURL('image/png'));
    } catch {
      // пустой canvas
    }
  };

  const startDraw = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!enabled) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx) return;

    drawingRef.current = true;
    canvas!.setPointerCapture(e.pointerId);
    const { x, y } = getPos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);

    if (tool === 'eraser') {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.strokeStyle = 'rgba(0,0,0,1)';
      ctx.lineWidth = brushSize * 3;
    } else {
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = brushSize;
    }
  };

  const draw = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const { x, y } = getPos(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const endDraw = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    canvasRef.current?.releasePointerCapture(e.pointerId);
    exportCanvas();
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    onChange(null);
  };

  if (!enabled) return null;

  return (
    <div className="absolute inset-0 z-[1] flex flex-col pointer-events-none">
      <div className="pointer-events-auto flex flex-wrap items-center gap-2 p-2 m-2 self-start rounded-lg bg-white/90 dark:bg-gray-900/90 backdrop-blur border border-gray-200 dark:border-gray-700 shadow-sm">
        <button
          type="button"
          onClick={() => setTool('brush')}
          className={`p-2 rounded-lg min-w-[44px] min-h-[44px] flex items-center justify-center ${
            tool === 'brush' ? 'bg-primary-100 dark:bg-primary-900 text-primary-700' : 'hover:bg-gray-100 dark:hover:bg-gray-800'
          }`}
          title="Кисть"
        >
          <Paintbrush className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => setTool('eraser')}
          className={`p-2 rounded-lg min-w-[44px] min-h-[44px] flex items-center justify-center ${
            tool === 'eraser' ? 'bg-primary-100 dark:bg-primary-900 text-primary-700' : 'hover:bg-gray-100 dark:hover:bg-gray-800'
          }`}
          title="Ластик"
        >
          <Eraser className="h-4 w-4" />
        </button>
        <input
          type="range"
          min={1}
          max={12}
          value={brushSize}
          onChange={(e) => setBrushSize(Number(e.target.value))}
          className="w-20 accent-primary-600"
          title="Толщина кисти"
        />
        <button
          type="button"
          onClick={clearCanvas}
          className="p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/30 text-red-600 min-w-[44px] min-h-[44px] flex items-center justify-center"
          title="Очистить"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
      <div ref={containerRef} className="flex-1 pointer-events-auto">
        <canvas
          ref={canvasRef}
          className="absolute inset-0 touch-none cursor-crosshair opacity-90"
          onPointerDown={startDraw}
          onPointerMove={draw}
          onPointerUp={endDraw}
          onPointerLeave={endDraw}
        />
      </div>
    </div>
  );
}
