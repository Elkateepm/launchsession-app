import React, { createContext, useContext, useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const OrgContext = createContext(null)

export function OrgProvider({ children }) {
  const [org,     setOrg]     = useState(null)
  const [loading, setLoading] = useState(true)
    const [noOrg,   setNoOrg]   = useState(false)

  useEffect(() => {
    const detectOrg = async () => {
      const hostname = window.location.hostname
      const pathname = window.location.pathname
      const params = new URLSearchParams(window.location.search)

      if (pathname === '/org-search') {
        localStorage.removeItem('launchsession_org_slug')
        setOrg(null)
        setNoOrg(true)
        setLoading(false)
        return
      }

      let slug = params.get('org')

      if (!slug && pathname !== '/login') {
        slug = localStorage.getItem('launchsession_org_slug')
      }

      if (!slug && hostname.includes('.launchsession.app')) {
        slug = hostname.split('.')[0]
      }

      if (!slug && hostname.includes('.launchsession.co.uk')) {
        const subdomain = hostname.split('.')[0]
        if (subdomain !== 'www' && subdomain !== 'launchsession') {
          slug = subdomain
        }
      }

      if (!slug) {
        setNoOrg(true)
        setLoading(false)
        return
      }

      localStorage.setItem('launchsession_org_slug', slug)

      const { data, error } = await supabase
        .from('organisations')
        .select('*')
        .eq('slug', slug)
        .eq('status', 'active')
        .single()

      if (error || !data) {
        localStorage.removeItem('launchsession_org_slug')
        setOrg(null)
        setNoOrg(true)
      } else {
        setOrg(data)
        setNoOrg(false)
        document.documentElement.style.setProperty('--org-primary', data.primary_color || '#1B9AAA')
        document.title = data.name || 'LaunchSession'
      }

      setLoading(false)
    }

    detectOrg()
  }, [])

  return (
    <OrgContext.Provider value={{ org, loading, noOrg }}>
      {children}
    </OrgContext.Provider>
  )
}

export const useOrg = () => useContext(OrgContext)
