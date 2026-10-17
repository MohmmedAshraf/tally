'use client'

import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'

export function FitStage({
  width,
  children,
  className,
}: {
  readonly width: number
  readonly children: ReactNode
  readonly className?: string
}): ReactNode {
  const frame = useRef<HTMLDivElement>(null)
  const stage = useRef<HTMLDivElement>(null)
  const [fit, setFit] = useState<{ scale: number; height: number }>()

  useLayoutEffect(() => {
    const outer = frame.current
    const inner = stage.current
    if (outer === null || inner === null) return
    const measure = (): void => {
      const scale = Math.min(1, outer.clientWidth / width)
      const height = Math.ceil(inner.offsetHeight * scale)
      setFit((current) =>
        current?.scale === scale && current.height === height ? current : { scale, height },
      )
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(outer)
    observer.observe(inner)
    return () => observer.disconnect()
  }, [width])

  return (
    <div ref={frame} className="relative w-full overflow-x-clip" style={{ height: fit?.height }}>
      <div
        ref={stage}
        className={className}
        style={{
          position: 'relative',
          left: '50%',
          width,
          marginLeft: -width / 2,
          transformOrigin: '50% 0',
          transform: fit === undefined || fit.scale === 1 ? undefined : `scale(${fit.scale})`,
        }}
      >
        {children}
      </div>
    </div>
  )
}
