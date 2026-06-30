// AUTH FLOW LOCK: /org-search must clear saved org and never default to a previous organisation.
import React, { createContext, useContext, useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const OrgContext = createContext(null)

export function OrgProvider({ children }) {
  const [org,     setOrg]     = useState(null)
  const [loading, setLoading] = useState(true)
    const [noOrg,   setNoOrg]   = useState(false)

  useEffect(() => {
    let pollInterval = null

    const verifyOrgStillActive = async (slug) => {
      const { data, error } = await supabase
        .from('organisations')
        .select('id, status')
        .eq('slug', slug)
        .in('status', ['active', 'trial'])
        .single()

      if (error || !data) {
        clearInterval(pollInterval)
        localStorage.removeItem('launchsession_org_slug')
        await supabase.auth.signOut()
        window.location.replace('/org-search')
      }
    }

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

      // Only fall back to a previously saved org when the user is returning
      // to a route that implies "continue where I left off" (the dashboard,
      // or a deep link other than the bare root). A bare '/' visit on the
      // app subdomain — or the login screen — should always offer org
      // search rather than silently re-entering the last workspace.
      const isBareRoot = pathname === '/'
      if (!slug && pathname !== '/login' && !isBareRoot) {
        slug = localStorage.getItem('launchsession_org_slug')
      }

      if (!slug && hostname.includes('.launchsession.app')) {
        slug = hostname.split('.')[0]
      }

      if (!slug && hostname.includes('.launchsession.co.uk')) {
        const subdomain = hostname.split('.')[0]
        // 'app' and 'admin' are reserved subdomains, not org slugs
        if (!['www', 'launchsession', 'app', 'admin'].includes(subdomain)) {
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
        .in('status', ['active', 'trial'])
        .single()

      if (error || !data) {
        localStorage.removeItem('launchsession_org_slug')
        setOrg(null)
        setNoOrg(true)
      } else {
        setOrg(data)
        setNoOrg(false)
        document.documentElement.style.setProperty('--org-primary', data.primary_color || '#1B9AAA')
        if (data.logo_url) {
          const favicon = document.querySelector("link[rel='icon']") || document.createElement('link')
          favicon.rel = 'icon'
          favicon.href = data.logo_url + '?t=' + Date.now()
          document.head.appendChild(favicon)
        }
        document.title = data.name || 'LaunchSession'
        pollInterval = setInterval(() => verifyOrgStillActive(slug), 30000)
      }

      setLoading(false)
    }

    detectOrg()
    return () => { if (pollInterval) clearInterval(pollInterval) }
  }, [])

  const refreshOrg = async () => {
    const slug = localStorage.getItem('launchsession_org_slug')
    if (!slug) return
    const { data } = await supabase.from('organisations').select('*').eq('slug', slug).single()
    if (data) {
      setOrg(data)
      document.documentElement.style.setProperty('--org-primary', data.primary_color || '#1B9AAA')
      document.title = data.name || 'LaunchSession'
    }
  }

  return (
    <OrgContext.Provider value={{ org, loading, noOrg, refreshOrg }}>
      {children}
    </OrgContext.Provider>
  )
}

export const useOrg = () => useContext(OrgContext)
