import React, { useEffect, useState } from 'react'
import LeadsGenerator from './components/LeadsGenerator'
import LeadFlow from './components/LeadFlow'
import EstimateAnalysis from './components/PublicEstimate/EstimateAnalysis'
import EstimateResults from './components/PublicEstimate/EstimateResults'
import BookingForm from './components/PublicEstimate/BookingForm'
import AdminPlatform from './components/Admin/AdminPlatform'
import PartnerPlatform from './components/Partner/PartnerPlatform'

const deriveRoute = () => {
  if (window.location.hash) return window.location.hash
  if (window.location.pathname.startsWith('/admin')) return `#${window.location.pathname}`
  if (window.location.pathname.startsWith('/partner')) return `#${window.location.pathname}`
  return '#/'
}

const App: React.FC = () => {
  const [route, setRoute] = useState(deriveRoute())
  const routePath = route.split('?')[0]

  useEffect(() => {
    const handleHashChange = () => setRoute(deriveRoute())
    const handlePopState = () => setRoute(deriveRoute())
    window.addEventListener('hashchange', handleHashChange)
    window.addEventListener('popstate', handlePopState)
    return () => {
      window.removeEventListener('hashchange', handleHashChange)
      window.removeEventListener('popstate', handlePopState)
    }
  }, [])

  if (routePath.startsWith('#/admin')) return <AdminPlatform route={route} />
  if (routePath.startsWith('#/partner')) return <PartnerPlatform route={route} />

  if (routePath === '#/lead-flow') return <LeadFlow />
  if (routePath === '#/estimate-analysis') return <EstimateAnalysis />
  if (routePath === '#/estimate-results') return <EstimateResults />
  if (routePath === '#/booking-form') return <BookingForm />

  return <LeadsGenerator />
}

export default App
