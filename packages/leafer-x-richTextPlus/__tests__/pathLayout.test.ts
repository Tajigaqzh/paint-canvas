import { describe, expect, it } from 'vitest'
import {
  layoutGlyphsOnPath,
  resolveCirclePathStartAngle,
  sampleBezierPath,
  sampleCirclePath
} from '../src/pathLayout'

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
