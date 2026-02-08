import { LocationProvider, Route, Router, useLocation } from 'preact-iso'
import { GUIDE_SEO_ROUTES, SEO_ROUTE_BY_ROUTER_PATH } from './lib/seo-routes'
import { AppErrorBoundary } from './components/app-error-boundary'
import { Home } from './routes/home'
import { HowItWorks } from './routes/how-it-works'
import { GUIDE_ROUTE_COMPONENT_BY_ID } from './routes/guides'
import { NotFound } from './routes/not-found'
import { HOME_ROUTE, HOW_IT_WORKS_ROUTE, NOT_FOUND_ROUTE } from './routes/shared'

function Header() {
  const { path } = useLocation()
  const normalizedPath = path === '/supernova-image' ? HOME_ROUTE.routerPath : path
  const matchedRoute = SEO_ROUTE_BY_ROUTER_PATH.get(normalizedPath)
  const isHome = path === '/' || matchedRoute?.id === 'home'

  return (
    <div class="header">
      {isHome ? <h1>HDR PNG Converter</h1> : <div class="header__brand">Supernova</div>}
      <p>
        Convert any image to <span class="accent">HDR PNG</span> — runs entirely in your browser
      </p>
      {isHome && (
        <a class="how-link" href={HOW_IT_WORKS_ROUTE.routerPath}>
          How it works
        </a>
      )}
    </div>
  )
}

export function App() {
  return (
    <AppErrorBoundary>
      <LocationProvider>
        <Header />
        <Router>
          <Route path={HOME_ROUTE.routerPath} component={Home} />
          <Route path={HOW_IT_WORKS_ROUTE.routerPath} component={HowItWorks} />
          {GUIDE_SEO_ROUTES.map((route) => (
            <Route key={route.id} path={route.routerPath} component={GUIDE_ROUTE_COMPONENT_BY_ID.get(route.id)!} />
          ))}
          <Route path={NOT_FOUND_ROUTE.routerPath} component={NotFound} />
          <Route default component={NotFound} />
        </Router>
      </LocationProvider>
    </AppErrorBoundary>
  )
}
