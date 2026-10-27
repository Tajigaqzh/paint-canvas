import type {
  IPathAnchor,
  IPathPoint,
  ITextPathAlign,
  ITextPathDirection,
  ITextPathSide
} from './types'

export interface IPathSample extends IPathPoint {
  distance: number
  angle: number
}

export interface IPathGlyphLayout extends IPathSample {
  index: number
  rotation: number
}

export const normalizePolygonSides = (sides: number): number => {
  if (!Number.isFinite(sides)) return 3
  return Math.max(3, Math.min(128, Math.floor(sides)))
}

export const movePathAnchor = (
  anchors: IPathAnchor[],
  index: number,
  handle: 'anchor' | 'in' | 'out',
  x: number,
  y: number
): IPathAnchor[] => {
  const anchor = anchors[index]
  if (!anchor) return anchors

  const next = [...anchors]
  if (handle === 'anchor') {
    next[index] = { ...anchor, x, y }
  } else {
    const key = handle === 'in' ? 'handleIn' : 'handleOut'
    next[index] = { ...anchor, [key]: { x: x - anchor.x, y: y - anchor.y } }
  }
  return next
}

export const getPathBounds = (points: IPathPoint[], padding: number) => {
  if (!points.length) return { x: 0, y: 0, width: 0, height: 0 }
  const xs = points.map(point => point.x)
  const ys = points.map(point => point.y)
  const minX = Math.min(...xs) - padding
  const minY = Math.min(...ys) - padding
  const maxX = Math.max(...xs) + padding
  const maxY = Math.max(...ys) + padding
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY }
}

/** 把圆形文字的视觉锚点角度换算为完整圆路径的采样起点。 */
export const resolveCirclePathStartAngle = (anchorAngle: number, align: ITextPathAlign) =>
  align === 'center' ? anchorAngle - 180 : anchorAngle

/** 生成以节点原点为中心的正多边形路径锚点。 */
export const createRegularPolygonPath = (sides: number, radius: number, startAngle = -90): IPathAnchor[] => {
  const sideCount = normalizePolygonSides(sides)
  const safeRadius = Math.max(1, radius)
  return Array.from({ length: sideCount }, (_, index) => {
    const angle = ((startAngle + index * 360 / sideCount) * Math.PI) / 180
    return {
      x: safeRadius * Math.cos(angle),
      y: safeRadius * Math.sin(angle)
    }
  })
}

const distance = (a: IPathPoint, b: IPathPoint) => Math.hypot(b.x - a.x, b.y - a.y)

const cubicPoint = (p0: IPathPoint, p1: IPathPoint, p2: IPathPoint, p3: IPathPoint, t: number) => {
  const mt = 1 - t
  const mt2 = mt * mt
  const t2 = t * t
  return {
    x: mt2 * mt * p0.x + 3 * mt2 * t * p1.x + 3 * mt * t2 * p2.x + t2 * t * p3.x,
    y: mt2 * mt * p0.y + 3 * mt2 * t * p1.y + 3 * mt * t2 * p2.y + t2 * t * p3.y
  }
}

const controlPoint = (anchor: IPathAnchor, handle: IPathPoint | undefined): IPathPoint => ({
  x: anchor.x + (handle?.x ?? 0),
  y: anchor.y + (handle?.y ?? 0)
})

const appendSample = (samples: IPathSample[], point: IPathPoint) => {
  const previous = samples.at(-1)
  const nextDistance = previous ? previous.distance + distance(previous, point) : 0
  samples.push({ ...point, distance: nextDistance, angle: previous?.angle ?? 0 })
  if (previous) previous.angle = Math.atan2(point.y - previous.y, point.x - previous.x)
}

/** 将锚点路径采样成带累计长度和切线角度的折线。 */
export const sampleBezierPath = (
  anchors: IPathAnchor[],
  closed = false,
  stepsPerSegment = 32
): IPathSample[] => {
  if (!anchors.length) return []
  const samples: IPathSample[] = []
  appendSample(samples, anchors[0])
  const segmentCount = closed ? anchors.length : anchors.length - 1
  for (let index = 0; index < segmentCount; index++) {
    const from = anchors[index]
    const to = anchors[(index + 1) % anchors.length]
    const c1 = controlPoint(from, from.handleOut)
    const c2 = controlPoint(to, to.handleIn)
    const curved = !!from.handleOut || !!to.handleIn
    const steps = curved ? Math.max(4, stepsPerSegment) : 1
    for (let step = 1; step <= steps; step++) {
      appendSample(samples, cubicPoint(from, c1, c2, to, step / steps))
    }
  }
  if (samples.length > 1) samples.at(-1)!.angle = samples.at(-2)!.angle
  return samples
}

/** 圆形预设使用对象原点作为圆心。 */
export const sampleCirclePath = (radius: number, startAngle = -90, steps = 256): IPathSample[] => {
  const safeRadius = Math.max(1, radius)
  const anchors: IPathAnchor[] = []
  for (let index = 0; index < steps; index++) {
    const angle = ((startAngle + index * 360 / steps) * Math.PI) / 180
    anchors.push({
      x: safeRadius * Math.cos(angle),
      y: safeRadius * Math.sin(angle)
    })
  }
  return sampleBezierPath(anchors, true, 1)
}

export const pointAtPathDistance = (samples: IPathSample[], target: number): IPathSample => {
  if (!samples.length) return { x: 0, y: 0, distance: 0, angle: 0 }
  const total = samples.at(-1)!.distance
  if (target < 0) {
    const first = samples[0]
    return {
      ...first,
      x: first.x + Math.cos(first.angle) * target,
      y: first.y + Math.sin(first.angle) * target,
      distance: target
    }
  }
  if (target > total) {
    const last = samples.at(-1)!
    const overflow = target - total
    return {
      ...last,
      x: last.x + Math.cos(last.angle) * overflow,
      y: last.y + Math.sin(last.angle) * overflow,
      distance: target
    }
  }
  const value = Math.max(0, Math.min(total, target))
  for (let index = 1; index < samples.length; index++) {
    const right = samples[index]
    if (right.distance < value) continue
    const left = samples[index - 1]
    const span = Math.max(right.distance - left.distance, 1e-6)
    const ratio = (value - left.distance) / span
    return {
      x: left.x + (right.x - left.x) * ratio,
      y: left.y + (right.y - left.y) * ratio,
      distance: value,
      angle: left.angle
    }
  }
  return { ...samples.at(-1)! }
}

export const getPathCaret = (
  samples: IPathSample[],
  glyph: IPathGlyphLayout,
  advance: number,
  options: {
    atEnd?: boolean
    direction?: ITextPathDirection
    side?: ITextPathSide
    rotation?: number
  } = {}
) => {
  const reverse = options.direction === 'reverse'
  const direction = reverse ? -1 : 1
  const offset = (options.atEnd ? 1 : -1) * direction * Math.max(0, advance) / 2
  const point = pointAtPathDistance(samples, glyph.distance + offset)
  const textRotation = point.angle + (reverse ? Math.PI : 0) + (options.side === 'inner' ? Math.PI : 0) + (options.rotation ?? 0)
  return {
    x: point.x,
    y: point.y,
    rotation: textRotation - Math.PI / 2
  }
}

export const layoutGlyphsOnPath = (
  samples: IPathSample[],
  advances: number[],
  options: {
    align?: ITextPathAlign
    direction?: ITextPathDirection
    side?: ITextPathSide
  } = {}
): IPathGlyphLayout[] => {
  if (!samples.length) return []
  const total = samples.at(-1)!.distance
  const textLength = advances.reduce((sum, value) => sum + Math.max(0, value), 0)
  const align = options.align ?? 'center'
  let cursor = align === 'start' ? 0 : align === 'end' ? total - textLength : (total - textLength) / 2
  const reverse = options.direction === 'reverse'
  const sideRotation = options.side === 'inner' ? Math.PI : 0
  return advances.map((advance, index) => {
    const centerDistance = Math.max(0, advance) / 2 + cursor
    const pathDistance = reverse ? total - centerDistance : centerDistance
    const point = pointAtPathDistance(samples, pathDistance)
    cursor += Math.max(0, advance)
    const tangent = point.angle + (reverse ? Math.PI : 0)
    return {
      ...point,
      index,
      rotation: tangent + sideRotation
    }
  })
}

