import { useRef, useCallback, useEffect } from 'react';

interface SwipeConfig {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  threshold?: number;
  edgeThreshold?: number; // Distance from edge to trigger edge swipe
}

export function useSwipeGesture(
  elementRef: React.RefObject<HTMLElement>,
  config: SwipeConfig
) {
  const { 
    onSwipeLeft, 
    onSwipeRight, 
    threshold = 50,
    edgeThreshold = 30 
  } = config;
  
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const touchEnd = useRef<{ x: number; y: number } | null>(null);

  const onTouchStart = useCallback((e: TouchEvent) => {
    touchEnd.current = null;
    touchStart.current = {
      x: e.targetTouches[0].clientX,
      y: e.targetTouches[0].clientY
    };
  }, []);

  const onTouchMove = useCallback((e: TouchEvent) => {
    touchEnd.current = {
      x: e.targetTouches[0].clientX,
      y: e.targetTouches[0].clientY
    };
  }, []);

  const onTouchEnd = useCallback(() => {
    if (!touchStart.current || !touchEnd.current) return;

    const distanceX = touchStart.current.x - touchEnd.current.x;
    const distanceY = touchStart.current.y - touchEnd.current.y;
    
    // Only trigger if horizontal swipe is more significant than vertical
    const isHorizontalSwipe = Math.abs(distanceX) > Math.abs(distanceY);
    const isSignificantSwipe = Math.abs(distanceX) > threshold;

    if (isHorizontalSwipe && isSignificantSwipe) {
      const isLeftSwipe = distanceX > 0;
      const isRightSwipe = distanceX < 0;
      const startedFromEdge = touchStart.current.x < edgeThreshold;

      if (isLeftSwipe && onSwipeLeft) {
        onSwipeLeft();
      }
      
      if (isRightSwipe && startedFromEdge && onSwipeRight) {
        onSwipeRight();
      }
    }

    touchStart.current = null;
    touchEnd.current = null;
  }, [onSwipeLeft, onSwipeRight, threshold, edgeThreshold]);

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    element.addEventListener('touchstart', onTouchStart, { passive: true });
    element.addEventListener('touchmove', onTouchMove, { passive: true });
    element.addEventListener('touchend', onTouchEnd, { passive: true });

    return () => {
      element.removeEventListener('touchstart', onTouchStart);
      element.removeEventListener('touchmove', onTouchMove);
      element.removeEventListener('touchend', onTouchEnd);
    };
  }, [elementRef, onTouchStart, onTouchMove, onTouchEnd]);
}
