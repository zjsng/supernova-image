import { Fragment } from 'preact'
import type { ComponentChildren } from 'preact'
import { useEffect, useRef } from 'preact/hooks'
import { useHead } from '../lib/use-head'
import {
  getSeoRouteByCanonicalPath,
  getSeoRoutesByTemplate,
  getSingleSeoRouteByTemplate,
  GUIDE_SEO_ROUTES,
  type SeoRouteMeta,
} from '../lib/seo-routes'

export const HOME_ROUTE = getSingleSeoRouteByTemplate('home')
export const HOW_IT_WORKS_ROUTE = getSingleSeoRouteByTemplate('how-it-works')
export const NOT_FOUND_ROUTE = getSingleSeoRouteByTemplate('not-found')
export const FORMAT_GUIDE_ROUTES = getSeoRoutesByTemplate('intent-guide')

export function guideLabelForRoute(route: SeoRouteMeta): string {
  if (route.guideLabel) return route.guideLabel
  return route.title.replace(/\s+\|\s+Supernova$/, '')
}

export function useSeoRouteHead(canonicalPath: string): void {
  const route = getSeoRouteByCanonicalPath(canonicalPath)
  useHead(route.title, route.description, route.canonicalPath, { robots: route.robots })
}

export function RouteJsonLd({ data }: { data: Record<string, unknown> }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }} />
}

export function ArrowLeftIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <path d="M19 12H5m0 0l7 7m-7-7l7-7" />
    </svg>
  )
}

const STATUS_ICON_PATHS: Record<string, string> = {
  full: 'M20 6L9 17l-5-5',
  partial: 'M5 12h14',
  none: 'M18 6L6 18M6 6l12 12',
}

function StatusIcon({ status }: { status: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <path d={STATUS_ICON_PATHS[status]} />
    </svg>
  )
}

export function BrowserCompat() {
  const browsers = [
    { name: 'Chrome', engine: 'cICP', status: 'full' as const, note: 'Full HDR rendering' },
    { name: 'Edge', engine: 'cICP', status: 'full' as const, note: 'Full HDR rendering' },
    { name: 'Safari', engine: 'ICC / EDR', status: 'partial' as const, note: 'macOS only' },
    { name: 'Firefox', engine: '—', status: 'none' as const, note: 'No extended brightness' },
  ]

  return (
    <div class="compat-grid" role="list" aria-label="Browser HDR support">
      {browsers.map((browser) => (
        <div class={`compat-card compat-card--${browser.status}`} role="listitem" key={browser.name}>
          <div class="compat-card__status" aria-hidden="true">
            <StatusIcon status={browser.status} />
          </div>
          <span class="compat-card__name">{browser.name}</span>
          <span class="compat-card__engine">{browser.engine}</span>
          <span class="compat-card__note">{browser.note}</span>
        </div>
      ))}
    </div>
  )
}

function useReveal() {
  const ref = useRef<HTMLElement>(null)

  useEffect(() => {
    const element = ref.current
    if (!element) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    element.classList.add('will-reveal')
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry) return
        if (entry.isIntersecting) {
          element.classList.add('revealed')
          observer.unobserve(element)
        }
      },
      { threshold: 0.1 },
    )

    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  return { ref }
}

interface RevealSectionProps {
  children: ComponentChildren
  className?: string
}

export function RevealSection({ children, className = '' }: RevealSectionProps) {
  const { ref } = useReveal()

  return (
    <section ref={ref} class={className}>
      {children}
    </section>
  )
}

export function GuideLinksInline() {
  return (
    <>
      {GUIDE_SEO_ROUTES.map((route, index) => (
        <Fragment key={route.id}>
          {index > 0 && ' · '}
          <a href={route.routerPath}>{guideLabelForRoute(route)}</a>
        </Fragment>
      ))}
    </>
  )
}
