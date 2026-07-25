import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import type { WorkoutComment } from '@/types/db';

const STORAGE_KEY = 'workout-comment-views-v1';

type ViewMap = Record<string, string>;

type CommentViewsContextValue = {
  markViewed: (workoutId: string) => void;
  getViewedAt: (workoutId: string) => string | null;
  unreadCount: (
    workoutId: string,
    comments: WorkoutComment[],
    currentUserId: string | null | undefined,
  ) => number;
};

const CommentViewsContext = createContext<CommentViewsContextValue | undefined>(undefined);

export function CommentViewsProvider({ children }: { children: ReactNode }) {
  const [viewMap, setViewMap] = useState<ViewMap>({});
  // Keep a ref in sync so callbacks read the latest state without re-binding.
  const viewMapRef = useRef<ViewMap>({});

  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (cancelled || !raw) return;
        try {
          const parsed = JSON.parse(raw) as ViewMap;
          if (parsed && typeof parsed === 'object') {
            viewMapRef.current = parsed;
            setViewMap(parsed);
          }
        } catch {
          // Corrupt JSON — ignore, fall back to empty map.
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const markViewed = useCallback((workoutId: string) => {
    const now = new Date().toISOString();
    const next = { ...viewMapRef.current, [workoutId]: now };
    viewMapRef.current = next;
    setViewMap(next);
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
  }, []);

  const getViewedAt = useCallback(
    (workoutId: string): string | null => viewMap[workoutId] ?? null,
    [viewMap],
  );

  const unreadCount = useCallback(
    (
      workoutId: string,
      comments: WorkoutComment[],
      currentUserId: string | null | undefined,
    ): number => {
      if (!comments.length) return 0;
      const viewedAt = viewMap[workoutId] ?? null;
      let count = 0;
      for (const c of comments) {
        if (currentUserId && c.user_id === currentUserId) continue;
        if (!viewedAt || c.created_at > viewedAt) count += 1;
      }
      return count;
    },
    [viewMap],
  );

  const value = useMemo<CommentViewsContextValue>(
    () => ({ markViewed, getViewedAt, unreadCount }),
    [markViewed, getViewedAt, unreadCount],
  );

  return (
    <CommentViewsContext.Provider value={value}>{children}</CommentViewsContext.Provider>
  );
}

export function useCommentViews(): CommentViewsContextValue {
  const ctx = useContext(CommentViewsContext);
  if (!ctx) {
    throw new Error('useCommentViews must be used within CommentViewsProvider');
  }
  return ctx;
}
