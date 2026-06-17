import React, { createContext, useContext, useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const OrgContext = createContext(null)

export function OrgProvider({ children }) {
  const [org,     setOrg]     = useState(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)
  const [noOrg,   setNoOrg]   = useState(false)

  useEffect(() => {
    const detectOrg = async () => {
      const hostname = window.location.hostname
      let slug = null

      const params = new URLSearchParams(window.location.search)
      slug = params.get('org') || localStorage.getItem('launchsession_org_slug')

      if (!slug && hostname.includes('.launchsession.app')) {
        slug = hostname.split('.')[0]
      }

      if (!slug && hostname.includes('.launchsession.co.uk')) {
        slug = hostname.split('.')[0]
      }

      if (slug && slug !== 'www' && slug !== 'app') {
        localStorage.setItem('launchsession_org_slug', slug)
      }

      if (!slug) {
        setNoOrg(true)
        setLoading(false)
        return
      }

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
        document.documentElement.style.setProperty('--org-primary', data.primary_color || '#1B9AAA')
        document.title = data.name || 'LaunchSession'
      }
      setLoading(false)
    }
    detectOrg()
  }, [])

  return (
    <OrgContext.Provider value={{ org, loading, error, noOrg }}>
      {children}
    </OrgContext.Provider>
  )
}

export const useOrg = () => useContext(OrgContext)
