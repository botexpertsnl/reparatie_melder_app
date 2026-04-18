import { useCallback, useMemo, useRef, useState, type TouchEvent } from "react";

type TouchPoint = { x: number; y: number };

type UseMobileRowSwipeOptions = {
  enabled: boolean;
  onSwipeOpen: () => void;
  allowSwipeFromInteractiveRoot?: boolean;
  threshold?: number;
  maxVerticalMovement?: number;
  maxPreviewOffset?: number;
  maxPreviewOffsetRatio?: number;
  horizontalIntentRatio?: number;
};

const DEFAULT_THRESHOLD = 72;
const DEFAULT_MAX_VERTICAL_MOVEMENT = 56;
const DEFAULT_MAX_PREVIEW_OFFSET = 30;
const DEFAULT_HORIZONTAL_INTENT_RATIO = 1.2;

export function useMobileRowSwipe({
  enabled,
  onSwipeOpen,
  allowSwipeFromInteractiveRoot = false,
  threshold = DEFAULT_THRESHOLD,
  maxVerticalMovement = DEFAULT_MAX_VERTICAL_MOVEMENT,
  maxPreviewOffset = DEFAULT_MAX_PREVIEW_OFFSET,
  maxPreviewOffsetRatio,
  horizontalIntentRatio = DEFAULT_HORIZONTAL_INTENT_RATIO,
}: UseMobileRowSwipeOptions) {
  const touchStartRef = useRef<TouchPoint | null>(null);
  const blockedByInteractiveTargetRef = useRef(false);
  const [previewOffset, setPreviewOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  const resetGesture = useCallback(() => {
    touchStartRef.current = null;
    blockedByInteractiveTargetRef.current = false;
    setIsDragging(false);
    setPreviewOffset(0);
  }, []);

  const onTouchStart = useCallback((event: TouchEvent<HTMLElement>) => {
    if (!enabled) return;

    const firstTouch = event.touches[0];
    if (!firstTouch) return;

    const touchedInteractiveElement = (event.target as HTMLElement | null)?.closest(
      "button, a, input, select, textarea, [data-swipe-ignore='true']"
    );

    const isCurrentTargetInteractive =
      touchedInteractiveElement != null &&
      touchedInteractiveElement === event.currentTarget;

    blockedByInteractiveTargetRef.current = Boolean(
      touchedInteractiveElement && !(allowSwipeFromInteractiveRoot && isCurrentTargetInteractive)
    );
    if (blockedByInteractiveTargetRef.current) {
      touchStartRef.current = null;
      return;
    }

    touchStartRef.current = { x: firstTouch.clientX, y: firstTouch.clientY };
  }, [allowSwipeFromInteractiveRoot, enabled]);

  const onTouchMove = useCallback((event: TouchEvent<HTMLElement>) => {
    if (!enabled || blockedByInteractiveTargetRef.current) return;
    const touchStart = touchStartRef.current;
    const firstTouch = event.touches[0];
    if (!touchStart || !firstTouch) return;

    const deltaX = firstTouch.clientX - touchStart.x;
    const deltaY = firstTouch.clientY - touchStart.y;

    if (Math.abs(deltaX) <= Math.abs(deltaY) * horizontalIntentRatio) {
      if (isDragging) {
        setIsDragging(false);
        setPreviewOffset(0);
      }
      return;
    }

    if (deltaX >= 0) {
      if (isDragging) {
        setIsDragging(false);
        setPreviewOffset(0);
      }
      return;
    }

    const maxPreviewOffsetForRow =
      typeof maxPreviewOffsetRatio === "number"
        ? Math.round(event.currentTarget.clientWidth * maxPreviewOffsetRatio)
        : maxPreviewOffset;

    setIsDragging(true);
    setPreviewOffset(Math.max(-maxPreviewOffsetForRow, deltaX));
  }, [enabled, horizontalIntentRatio, isDragging, maxPreviewOffset, maxPreviewOffsetRatio]);

  const onTouchEnd = useCallback((event: TouchEvent<HTMLElement>) => {
    if (!enabled || blockedByInteractiveTargetRef.current) {
      resetGesture();
      return;
    }

    const touchStart = touchStartRef.current;
    const firstTouch = event.changedTouches[0];
    if (!touchStart || !firstTouch) {
      resetGesture();
      return;
    }

    const deltaX = firstTouch.clientX - touchStart.x;
    const deltaY = firstTouch.clientY - touchStart.y;
    const absDeltaY = Math.abs(deltaY);
    const absDeltaX = Math.abs(deltaX);
    const hasHorizontalIntent = absDeltaX > absDeltaY * horizontalIntentRatio;
    const passedThreshold = deltaX <= -threshold;
    const withinVerticalLimit = absDeltaY <= maxVerticalMovement;

    if (hasHorizontalIntent && passedThreshold && withinVerticalLimit) {
      onSwipeOpen();
    }

    resetGesture();
  }, [enabled, horizontalIntentRatio, maxVerticalMovement, onSwipeOpen, resetGesture, threshold]);

  const onTouchCancel = useCallback(() => {
    resetGesture();
  }, [resetGesture]);

  const swipeStyle = useMemo(
    () => ({
      transform: previewOffset !== 0 ? `translateX(${previewOffset}px)` : undefined,
      transition: isDragging ? "none" : "transform 160ms ease-out",
      willChange: previewOffset !== 0 ? "transform" : undefined,
    }),
    [isDragging, previewOffset]
  );

  return {
    swipeHandlers: {
      onTouchStart,
      onTouchMove,
      onTouchEnd,
      onTouchCancel,
    },
    swipeStyle,
  };
}
