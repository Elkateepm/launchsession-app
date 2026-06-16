import React, { createContext, useContext, useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const OrgContext = createContext(null)

export function OrgProvider({ children }) {
  const [org,     setOrg]     = useState(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)

  useEffect(() => {
    const detectOrg = async () => {
      const hostname = window.location.hostname
      let slug = null

      // Detect subdomain e.g. solidaritysports.launchsession.app
      if (hostname.includes('.launchsession.app')) {
        slug = hostname.split('.')[0]
      } else {
        // Fallback: ?org= param works everywhere (localhost + Vercel preview)
        const params = new URLSearchParams(window.location.search)
        slug = params.get('org') || 'solidarity-sports'
      }

      if (!slug) { setError('No organisation detected'); setLoading(false); return }

      const { data, error } = await supabase
        .from('organisations')
        .select('*')
        .eq('slug', slug)
        .eq('status', 'active')
        .single()

      if (error || !data) {
        setError('Organisation not found or inactive')
      } else {
        setOrg(data)
        // Apply org branding
        document.documentElement.style.setProperty('--org-primary', data.primary_color || '#1B9AAA')
        document.title = data.name || 'LaunchSession'
      }
      setLoading(false)
    }
    detectOrg()
  }, [])

  return (
    <OrgContext.Provider value={{ org, loading, error }}>
      {children}
    </OrgContext.Provider>
  )
}

export const useOrg = () => useContext(OrgContext)
