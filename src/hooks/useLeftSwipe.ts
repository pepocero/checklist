import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'

const DIRECTION_LOCK = 10
const OPEN_RATIO = 0.35

interface UseLeftSwipeOptions {
  openWidth: number
  closeSignal?: number
  disabled?: boolean
}

export function useLeftSwipe({
  openWidth,
  closeSignal = 0,
  disabled = false,
}: UseLeftSwipeOptions) {
  const [offset, setOffset] = useState(0)
  const [isSwiping, setIsSwiping] = useState(false)
  const offsetRef = useRef(0)
  const pointerIdRef = useRef<number | null>(null)
  const startXRef = useRef(0)
  const startYRef = useRef(0)
  const originOffsetRef = useRef(0)
  const axisRef = useRef<'none' | 'horizontal' | 'vertical'>('none')
  const movedRef = useRef(false)

  function applyOffset(next: number) {
    const clamped = Math.min(0, Math.max(-openWidth, next))
    offsetRef.current = clamped
    setOffset(clamped)
  }

  function clearTracking() {
    pointerIdRef.current = null
    axisRef.current = 'none'
    setIsSwiping(false)
  }

  function close(behavior: 'instant' | 'animate' = 'animate') {
    if (behavior === 'instant') {
      applyOffset(0)
    } else {
      applyOffset(0)
    }
    movedRef.current = false
    clearTracking()
  }

  useEffect(() => {
    if (closeSignal > 0) {
      close('instant')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only react to signal bumps
  }, [closeSignal])

  useEffect(() => {
    if (disabled) {
      close('instant')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [disabled])

  useEffect(() => {
    applyOffset(Math.max(-openWidth, Math.min(0, offsetRef.current)))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openWidth])

  function onPointerDown(event: ReactPointerEvent<HTMLElement>) {
    if (disabled || event.button !== 0) {
      return
    }

    pointerIdRef.current = event.pointerId
    startXRef.current = event.clientX
    startYRef.current = event.clientY
    originOffsetRef.current = offsetRef.current
    axisRef.current = 'none'
    movedRef.current = false
  }

  function onPointerMove(event: ReactPointerEvent<HTMLElement>) {
    if (pointerIdRef.current !== event.pointerId || disabled) {
      return
    }

    const deltaX = event.clientX - startXRef.current
    const deltaY = event.clientY - startYRef.current

    if (axisRef.current === 'none') {
      if (Math.abs(deltaX) < DIRECTION_LOCK && Math.abs(deltaY) < DIRECTION_LOCK) {
        return
      }

      if (Math.abs(deltaY) > Math.abs(deltaX)) {
        axisRef.current = 'vertical'
        pointerIdRef.current = null
        return
      }

      axisRef.current = 'horizontal'
      setIsSwiping(true)

      try {
        event.currentTarget.setPointerCapture(event.pointerId)
      } catch {
        // ignore
      }
    }

    if (axisRef.current !== 'horizontal') {
      return
    }

    event.preventDefault()
    const next = originOffsetRef.current + deltaX
    if (Math.abs(next - originOffsetRef.current) > 8) {
      movedRef.current = true
    }
    applyOffset(next)
  }

  function finishPointer(event: ReactPointerEvent<HTMLElement>) {
    if (pointerIdRef.current !== event.pointerId) {
      return
    }

    const axis = axisRef.current
    const pointerId = event.pointerId

    if (event.currentTarget.hasPointerCapture(pointerId)) {
      try {
        event.currentTarget.releasePointerCapture(pointerId)
      } catch {
        // ignore
      }
    }

    if (axis === 'horizontal') {
      const opened = offsetRef.current <= -openWidth * OPEN_RATIO
      applyOffset(opened ? -openWidth : 0)
    }

    clearTracking()
  }

  function onLostPointerCapture(event: ReactPointerEvent<HTMLElement>) {
    if (pointerIdRef.current !== event.pointerId) {
      return
    }

    if (axisRef.current === 'horizontal') {
      const opened = offsetRef.current <= -openWidth * OPEN_RATIO
      applyOffset(opened ? -openWidth : 0)
    }

    clearTracking()
  }

  function shouldIgnoreClick() {
    if (movedRef.current) {
      movedRef.current = false
      return true
    }

    if (offsetRef.current !== 0) {
      applyOffset(0)
      return true
    }

    return false
  }

  return {
    offset,
    isOpen: offset < -8,
    isSwiping,
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp: finishPointer,
      onPointerCancel: finishPointer,
      onLostPointerCapture,
    },
    close,
    shouldIgnoreClick,
  }
}
