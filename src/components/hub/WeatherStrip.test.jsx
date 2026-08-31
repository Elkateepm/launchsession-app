import React from 'react'
import { render, screen } from '@testing-library/react'
import { WeatherStrip } from './HubHomeSections'

// The real Open-Meteo response for London, so the shape under test is the shape
// the app is handed.
const DAYS = [
  { iso: '2026-08-31', label: 'Today', icon: '🌦️', description: 'Heavy drizzle', high: 23, low: 15, rain: 78 },
  { iso: '2026-09-01', label: 'Tue', icon: '☁️', description: 'Overcast', high: 22, low: 15, rain: 3 },
  { iso: '2026-09-02', label: 'Wed', icon: '☁️', description: 'Overcast', high: 22, low: 16, rain: 39 },
  { iso: '2026-09-03', label: 'Thu', icon: '☁️', description: 'Overcast', high: 24, low: 18, rain: 16 },
  { iso: '2026-09-04', label: 'Fri', icon: '🌦️', description: 'Light drizzle', high: 25, low: 20, rain: 31 },
]
const weather = { city: 'London', temp: 19, code: 3, wind: 8, high: 23, low: 15, rainChance: 78, days: DAYS }

const setup = (over = {}) => render(
  <WeatherStrip weather={{ ...weather, ...over }} icon="☁️" label="Overcast" primary="#1B9AAA" />)

describe('the week ahead', () => {
  it('shows all five days', () => {
    setup()
    for (const d of ['Today', 'Tue', 'Wed', 'Thu', 'Fri']) {
      expect(screen.getByText(d)).toBeInTheDocument()
    }
  })

  it('gives each day its own high and low', () => {
    setup()
    expect(screen.getByText('25°')).toBeInTheDocument()   // Friday's high
    expect(screen.getByText('20°')).toBeInTheDocument()   // Friday's low
  })

  it('shows a rain chance only where it is worth acting on', () => {
    // A row of "3%", "16%", "31%" is noise that makes the one 78% harder to
    // find, which is the number that decides whether a session goes outside.
    setup()
    expect(screen.getByText('78%')).toBeInTheDocument()
    for (const quiet of ['3%', '39%', '16%', '31%']) {
      expect(screen.queryByText(quiet)).not.toBeInTheDocument()
    }
  })

  it('still leads with today and the delivery verdict', () => {
    setup()
    expect(screen.getByText('19°')).toBeInTheDocument()
    expect(screen.getByText('Plan indoors')).toBeInTheDocument()
  })
})

describe('when there is no week to show', () => {
  it('renders the card without a forecast row rather than an empty grid', () => {
    setup({ days: [] })
    expect(screen.getByText('19°')).toBeInTheDocument()
    expect(screen.queryByText('Today')).not.toBeInTheDocument()
  })

  it('survives an older response with no days at all', () => {
    // A cached or partial payload must not take the whole of Home down.
    expect(() => setup({ days: undefined })).not.toThrow()
  })

  it('says what to do when the org has no city set', () => {
    render(<WeatherStrip weatherError icon="🌡️" label="" primary="#1B9AAA" />)
    expect(screen.getByText(/add a city in Settings/i)).toBeInTheDocument()
  })
})
