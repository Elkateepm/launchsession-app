import { contentBounds } from './brandImage'

// Builds an RGBA buffer filled with one colour, then paints a rectangle.
function canvas(w, h, bg, rect, ink) {
  const data = new Uint8ClampedArray(w * h * 4)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const inside = rect && x >= rect.x && x < rect.x + rect.w && y >= rect.y && y < rect.y + rect.h
      const c = inside ? ink : bg
      data.set(c, (y * w + x) * 4)
    }
  }
  return data
}

test('finds a mark on a transparent background', () => {
  const data = canvas(60, 30, [0, 0, 0, 0], { x: 20, y: 10, w: 20, h: 8 }, [20, 40, 200, 255])
  expect(contentBounds(data, 60, 30)).toEqual({ x: 20, y: 10, w: 20, h: 8, hasAlpha: true })
})

test('finds a mark flattened onto white', () => {
  const data = canvas(40, 40, [255, 255, 255, 255], { x: 5, y: 12, w: 30, h: 6 }, [200, 30, 30, 255])
  expect(contentBounds(data, 40, 40)).toEqual({ x: 5, y: 12, w: 30, h: 6, hasAlpha: false })
})

test('returns null for a blank image', () => {
  expect(contentBounds(canvas(10, 10, [255, 255, 255, 255]), 10, 10)).toBeNull()
})

test('ignores near-background noise on an opaque image', () => {
  const data = canvas(20, 20, [250, 250, 250, 255], { x: 0, y: 0, w: 20, h: 1 }, [246, 248, 250, 255])
  expect(contentBounds(data, 20, 20)).toBeNull()
})
