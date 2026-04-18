import { LocationProvider, Route, Router, useLocation } from 'preact-iso'
import { GUIDE_SEO_ROUTES, SEO_ROUTE_BY_ROUTER_PATH } from './lib/seo-routes'
import { AppErrorBoundary } from './components/app-error-boundary'
import { Home } from './routes/home'
import { HowItWorks } from './routes/how-it-works'
import { GUIDE_ROUTE_COMPONENT_BY_ID } from './routes/guides'
import { NotFound } from './routes/not-found'
import { HOME_ROUTE, HOW_IT_WORKS_ROUTE, NOT_FOUND_ROUTE } from './routes/shared'

function SpectralMark() {
  return (
    <svg class="header__brand-mark" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id="header-spectral-ring" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stop-color="var(--spec-red)" />
          <stop offset="25%" stop-color="var(--spec-amber)" />
          <stop offset="50%" stop-color="var(--spec-lime)" />
          <stop offset="75%" stop-color="var(--spec-cyan)" />
          <stop offset="100%" stop-color="var(--spec-violet)" />
        </linearGradient>
      </defs>
      <circle cx="9" cy="9" r="7" stroke="url(#header-spectral-ring)" stroke-width="1.5" />
      <circle class="dot" cx="9" cy="9" r="2.5" fill="var(--accent)" />
    </svg>
  )
}

function Header() {
  const { path } = useLocation()
  const normalizedPath = path === '/supernova-image' ? HOME_ROUTE.routerPath : path
  const matchedRoute = SEO_ROUTE_BY_ROUTER_PATH.get(normalizedPath)
  const isHome = path === '/' || matchedRoute?.id === 'home'

  const brandContent = (
    <>
      <SpectralMark />
      <span>Supernova</span>
    </>
  )

  return (
    <header class="header">
      <div class="header__lockup">
        {isHome ? (
          <span class="header__brand" aria-label="Supernova">
            {brandContent}
          </span>
        ) : (
          <a href={HOME_ROUTE.routerPath} class="header__brand">
            {brandContent}
          </a>
        )}
        {isHome && (
          <h1 class="header__tagline">
            <span class="header__tagline-sep" aria-hidden="true">
              ·
            </span>
            HDR PNG Converter
          </h1>
        )}
      </div>
      <nav class="header__nav" aria-label="Primary">
        <a class="header__nav-link how-link" href={HOW_IT_WORKS_ROUTE.routerPath}>
          How it works
        </a>
        <a
          class="header__nav-link header__nav-link--accent"
          href="https://github.com/zjsng/supernova-image"
          target="_blank"
          rel="noopener noreferrer"
        >
          GitHub ↗
        </a>
      </nav>
    </header>
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
