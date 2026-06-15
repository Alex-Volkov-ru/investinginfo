import { useCallback, useRef, useState } from 'react';
import { WhiteboardItem, WhiteboardZone } from '../types';

export interface BoardSnapshot {
  items: WhiteboardItem[];
  zones: WhiteboardZone[];
  budget: number;
  canvasData: string | null;
  boardName: string;
}

const MAX_UNDO = 50;

export function useBoardUndo() {
  const stackRef = useRef<BoardSnapshot[]>([]);
  const [canUndo, setCanUndo] = useState(false);

  const pushUndo = useCallback((snapshot: BoardSnapshot) => {
    stackRef.current = [...stackRef.current.slice(-(MAX_UNDO - 1)), snapshot];
    setCanUndo(stackRef.current.length > 0);
  }, []);

  const undo = useCallback((): BoardSnapshot | null => {
    if (stackRef.current.length === 0) return null;
    const snap = stackRef.current[stackRef.current.length - 1];
    stackRef.current = stackRef.current.slice(0, -1);
    setCanUndo(stackRef.current.length > 0);
    return snap;
  }, []);

  const clearUndo = useCallback(() => {
    stackRef.current = [];
    setCanUndo(false);
  }, []);

  return { pushUndo, undo, canUndo, clearUndo };
}
