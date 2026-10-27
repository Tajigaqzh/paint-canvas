import { describe, expect, it } from 'vitest'
import {
  createRegularPolygonPath,
  getPathCaret,
  getPathBounds,
  layoutGlyphsOnPath,
  movePathAnchor,
  normalizePolygonSides,
  resolveCirclePathStartAngle,
  sampleBezierPath,
  sampleCirclePath
} from '../src/pathLayout'

describe('createRegularPolygonPath', () => {
  it('creates the requested number of vertices around the origin', () => {
    const anchors = createRegularPolygonPath(5, 100)
    expect(anchors).toHaveLength(5)
    expect(Math.hypot(anchors[0].x, anchors[0].y)).toBeCloseTo(100)
  })

  it('clamps side counts below three to a triangle', () => {
    expect(createRegularPolygonPath(2, 50)).toHaveLength(3)
  })
})

describe('normalizePolygonSides', () => {
  it('normalizes values below three to the minimum', () => {
    expect(normalizePolygonSides(2)).toBe(3)
  })

  it('floors fractional values to an integer', () => {
    expect(normalizePolygonSides(5.9)).toBe(5)
  })

  it('caps values above the supported maximum', () => {
    expect(normalizePolygonSides(200)).toBe(128)
  })

  it('uses the minimum for non-finite values', () => {
    expect(normalizePolygonSides(Number.NaN)).toBe(3)
  })
})

describe('sampleBezierPath', () => {
  it('samples a straight two-anchor path with its total length', () => {
    const samples = sampleBezierPath([{ x: 0, y: 0 }, { x: 100, y: 0 }])
    expect(samples).toEqual([
      { x: 0, y: 0, distance: 0, angle: 0 },
      { x: 100, y: 0, distance: 100, angle: 0 }
    ])
  })

  it('samples control handles into a curved path', () => {
    const samples = sampleBezierPath([
      { x: 0, y: 0, handleOut: { x: 50, y: 100 } },
      { x: 100, y: 0, handleIn: { x: -50, y: 100 } }
    ])
    expect(Math.max(...samples.map(point => point.y))).toBeGreaterThan(70)
  })
})

describe('getPathBounds', () => {
  it('includes every path, glyph, and control point with padding', () => {
    expect(getPathBounds([
      { x: 10, y: 20 },
      { x: 50, y: -10 },
      { x: -5, y: 30 }
    ], 4)).toEqual({ x: -9, y: -14, width: 63, height: 48 })
  })

  it('returns empty bounds when there are no points', () => {
    expect(getPathBounds([], 4)).toEqual({ x: 0, y: 0, width: 0, height: 0 })
  })
})

describe('movePathAnchor', () => {
  const anchors = [{ x: 10, y: 20, handleOut: { x: 5, y: 8 } }]

  it('moves an anchor without changing its relative handles or the source path', () => {
    expect(movePathAnchor(anchors, 0, 'anchor', 30, 40)).toEqual([
      { x: 30, y: 40, handleOut: { x: 5, y: 8 } }
    ])
    expect(anchors[0]).toEqual({ x: 10, y: 20, handleOut: { x: 5, y: 8 } })
  })

  it('moves an incoming or outgoing handle in anchor-relative coordinates', () => {
    expect(movePathAnchor(anchors, 0, 'out', 22, 35)[0].handleOut).toEqual({ x: 12, y: 15 })
    expect(movePathAnchor(anchors, 0, 'in', 4, 9)[0].handleIn).toEqual({ x: -6, y: -11 })
  })

  it('keeps the path unchanged when the anchor index is out of range', () => {
    expect(movePathAnchor(anchors, 2, 'anchor', 30, 40)).toBe(anchors)
  })
})

describe('sampleCirclePath', () => {
  it('creates a closed path around the local origin', () => {
    const samples = sampleCirclePath(100, -90, 64)
    expect(samples[0].x).toBeCloseTo(0)
    expect(samples[0].y).toBeCloseTo(-100)
    expect(samples.at(-1)!.distance).toBeGreaterThan(600)
  })

  it('places center-aligned text anchor at the requested top angle', () => {
    expect(resolveCirclePathStartAngle(-90, 'center')).toBe(-270)
  })
})

describe('layoutGlyphsOnPath', () => {
  const path = sampleBezierPath([{ x: 0, y: 0 }, { x: 100, y: 0 }])

  it('centers glyphs by measured advances', () => {
    const glyphs = layoutGlyphsOnPath(path, [20, 20])
    expect(glyphs.map(glyph => glyph.x)).toEqual([40, 60])
  })

  it('reverses traversal without changing the path geometry', () => {
    const glyphs = layoutGlyphsOnPath(path, [20], { align: 'start', direction: 'reverse' })
    expect(glyphs[0].x).toBeCloseTo(90)
  })

  it('rotates inner-side text by half a turn', () => {
    const outer = layoutGlyphsOnPath(path, [20], { side: 'outer' })[0]
    const inner = layoutGlyphsOnPath(path, [20], { side: 'inner' })[0]
    expect(inner.rotation - outer.rotation).toBeCloseTo(Math.PI)
  })
})

describe('getPathCaret', () => {
  const samples = sampleBezierPath([{ x: 0, y: 0 }, { x: 100, y: 0 }])
  const glyph = layoutGlyphsOnPath(samples, [20], { align: 'start' })[0]
  const reverseGlyph = layoutGlyphsOnPath(samples, [20], { align: 'start', direction: 'reverse' })[0]

  it('places the caret at the leading edge before the first glyph', () => {
    expect(getPathCaret(samples, glyph, 20)).toEqual({ x: 0, y: 0, rotation: -Math.PI / 2 })
  })

  it('places the caret at the trailing edge after the current glyph', () => {
    expect(getPathCaret(samples, glyph, 20, { atEnd: true })).toEqual({ x: 20, y: 0, rotation: -Math.PI / 2 })
  })

  it('reverses the caret normal with reverse and inner path orientation', () => {
    expect(getPathCaret(samples, reverseGlyph, 20, { atEnd: true, direction: 'reverse' })).toEqual({
      x: 80,
      y: 0,
      rotation: Math.PI / 2
    })
    expect(getPathCaret(samples, glyph, 20, { atEnd: true, side: 'inner' }).rotation).toBeCloseTo(Math.PI / 2)
  })
})
