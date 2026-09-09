import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react'

const DIRECTION_LOCK = 8
const OPEN_RATIO = 0.32

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
  const [surface, setSurface] = useState<HTMLElement | null>(null)
  const offsetRef = useRef(0)
  const openWidthRef = useRef(openWidth)
  const disabledRef = useRef(disabled)
  const startXRef = useRef(0)
  const startYRef = useRef(0)
  const originOffsetRef = useRef(0)
  const axisRef = useRef<'none' | 'horizontal' | 'vertical'>('none')
  const movedRef = useRef(false)
  const activeTouchRef = useRef(false)
  const pointerIdRef = useRef<number | null>(null)

  openWidthRef.current = openWidth
  disabledRef.current = disabled

  const applyOffset = useCallback((next: number) => {
    const width = openWidthRef.current
    const clamped = Math.min(0, Math.max(-width, next))
    offsetRef.current = clamped
    setOffset(clamped)
  }, [])

  const snapFromCurrent = useCallback(() => {
    const width = openWidthRef.current
    const opened = offsetRef.current <= -width * OPEN_RATIO
    applyOffset(opened ? -width : 0)
  }, [applyOffset])

  const close = useCallback(() => {
    applyOffset(0)
    movedRef.current = false
    axisRef.current = 'none'
    activeTouchRef.current = false
    pointerIdRef.current = null
    setIsSwiping(false)
  }, [applyOffset])

  useEffect(() => {
    if (closeSignal > 0) {
      close()
    }
  }, [closeSignal, close])

  useEffect(() => {
    if (disabled) {
      close()
    }
  }, [disabled, close])

  useEffect(() => {
    applyOffset(Math.max(-openWidth, Math.min(0, offsetRef.current)))
  }, [openWidth, applyOffset])

  useEffect(() => {
    if (!surface) {
      return
    }

    function resetAxis() {
      axisRef.current = 'none'
      activeTouchRef.current = false
      setIsSwiping(false)
    }

    function onTouchStart(event: TouchEvent) {
      if (disabledRef.current || event.touches.length !== 1) {
        return
      }

      const touch = event.touches[0]
      startXRef.current = touch.clientX
      startYRef.current = touch.clientY
      originOffsetRef.current = offsetRef.current
      axisRef.current = 'none'
      movedRef.current = false
      activeTouchRef.current = true
      pointerIdRef.current = null
    }

    function onTouchMove(event: TouchEvent) {
      if (!activeTouchRef.current || disabledRef.current || event.touches.length !== 1) {
        return
      }

      const touch = event.touches[0]
      const deltaX = touch.clientX - startXRef.current
      const deltaY = touch.clientY - startYRef.current

      if (axisRef.current === 'none') {
        if (Math.abs(deltaX) < DIRECTION_LOCK && Math.abs(deltaY) < DIRECTION_LOCK) {
          return
        }

        if (Math.abs(deltaY) > Math.abs(deltaX)) {
          axisRef.current = 'vertical'
          activeTouchRef.current = false
          return
        }

        axisRef.current = 'horizontal'
        setIsSwiping(true)
      }

      if (axisRef.current !== 'horizontal') {
        return
      }

      event.preventDefault()
      const next = originOffsetRef.current + deltaX
      if (Math.abs(next - originOffsetRef.current) > 6) {
        movedRef.current = true
      }
      applyOffset(next)
    }

    function onTouchEnd() {
      if (axisRef.current === 'horizontal') {
        snapFromCurrent()
      }

      resetAxis()
    }

    surface.addEventListener('touchstart', onTouchStart, { passive: true })
    surface.addEventListener('touchmove', onTouchMove, { passive: false })
    surface.addEventListener('touchend', onTouchEnd)
    surface.addEventListener('touchcancel', onTouchEnd)

    return () => {
      surface.removeEventListener('touchstart', onTouchStart)
      surface.removeEventListener('touchmove', onTouchMove)
      surface.removeEventListener('touchend', onTouchEnd)
      surface.removeEventListener('touchcancel', onTouchEnd)
    }
  }, [surface, applyOffset, snapFromCurrent])

  function onPointerDown(event: ReactPointerEvent<HTMLElement>) {
    if (disabledRef.current || event.pointerType === 'touch' || event.button !== 0) {
      return
    }

    pointerIdRef.current = event.pointerId
    startXRef.current = event.clientX
    startYRef.current = event.clientY
    originOffsetRef.current = offsetRef.current
    axisRef.current = 'none'
    movedRef.current = false
    activeTouchRef.current = false
  }

  function onPointerMove(event: ReactPointerEvent<HTMLElement>) {
    if (pointerIdRef.current !== event.pointerId || disabledRef.current) {
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
    if (Math.abs(next - originOffsetRef.current) > 6) {
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
      snapFromCurrent()
    }

    pointerIdRef.current = null
    axisRef.current = 'none'
    setIsSwiping(false)
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
    setSurfaceRef: setSurface,
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp: finishPointer,
      onPointerCancel: finishPointer,
    },
    close,
    shouldIgnoreClick,
  }
}
