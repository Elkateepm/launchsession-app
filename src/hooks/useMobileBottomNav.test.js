import { renderHook, act } from '@testing-library/react'
import { computeIsMobileBottomNav, useMobileBottomNav } from './useMobileBottomNav'

const size = { w: window.innerWidth, h: window.innerHeight }
function resizeTo(w, h, event = 'resize') {
  window.innerWidth = w
  window.innerHeight = h
  act(() => { window.dispatchEvent(new Event(event)) })
}
afterEach(() => { window.innerWidth = size.w; window.innerHeight = size.h })

test('a phone held upright gets the dock; turned sideways it gets the side nav', () => {
  expect(computeIsMobileBottomNav(384, 780)).toBe(true)
  expect(computeIsMobileBottomNav(780, 384)).toBe(false)
  expect(computeIsMobileBottomNav(1280, 800)).toBe(false)
})

test('the keyboard opening does not switch the layout', () => {
  // A 384px-wide phone with the keyboard up is 384 x 360: wider than tall.
  // Read as "sideways", that swapped the layout and threw away whatever was
  // open, including a half-filled session wizard.
  expect(computeIsMobileBottomNav(384, 360)).toBe(false)
  window.innerWidth = 384; window.innerHeight = 780
  const { result } = renderHook(() => useMobileBottomNav())
  expect(result.current).toBe(true)
  resizeTo(384, 360)
  expect(result.current).toBe(true)
  resizeTo(384, 780)
  expect(result.current).toBe(true)
})

test('turning the phone still switches the layout, and back again', () => {
  window.innerWidth = 384; window.innerHeight = 780
  const { result } = renderHook(() => useMobileBottomNav())
  resizeTo(780, 384, 'orientationchange')
  expect(result.current).toBe(false)
  resizeTo(384, 780)
  expect(result.current).toBe(true)
})
