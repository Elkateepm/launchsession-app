import React from 'react'
import { render, screen, fireEvent, act } from '@testing-library/react'
import SplashScreen from './SplashScreen'

beforeEach(() => {
  jest.useFakeTimers()
  window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} })
  jest.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue()
})
afterEach(() => { jest.useRealTimers(); jest.restoreAllMocks() })
const advance = ms => act(() => { jest.advanceTimersByTime(ms) })

test('plays the clip inline and waits for the app before exiting', () => {
  const onExited = jest.fn()
  const { container, rerender } = render(<SplashScreen ready={false} onExited={onExited} />)
  const video = container.querySelector('video')
  expect(video.muted).toBe(true)
  expect(video).toHaveAttribute('playsinline')
  fireEvent.ended(video)
  advance(6000)
  expect(onExited).not.toHaveBeenCalled()
  rerender(<SplashScreen ready onExited={onExited} />)
  advance(0)
  advance(300)
  expect(onExited).toHaveBeenCalledTimes(1)
})

test('a failed clip falls back and releases a ready app', () => {
  const onExited = jest.fn()
  const { container } = render(<SplashScreen ready onExited={onExited} />)
  fireEvent.error(container.querySelector('video'))
  expect(screen.getByRole('img')).toBeInTheDocument()
  advance(500)
  advance(300)
  expect(onExited).toHaveBeenCalledTimes(1)
})

test('reduced motion uses the still without downloading the video', () => {
  window.matchMedia = () => ({ matches: true, addEventListener() {}, removeEventListener() {} })
  const onExited = jest.fn()
  const { container } = render(<SplashScreen ready onExited={onExited} />)
  expect(container.querySelector('video')).toBeNull()
  advance(500)
  advance(0)
  expect(onExited).toHaveBeenCalledTimes(1)
})

test('stalled playback cannot hold a ready app indefinitely', () => {
  const onExited = jest.fn()
  render(<SplashScreen ready onExited={onExited} />)
  advance(8000)
  advance(0)
  advance(300)
  expect(onExited).toHaveBeenCalledTimes(1)
})
