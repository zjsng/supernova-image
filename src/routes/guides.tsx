import { GUIDE_SEO_ROUTES, getSeoRouteById } from '../lib/seo-routes'
import {
  ArrowLeftIcon,
  BrowserCompat,
  FORMAT_GUIDE_ROUTES,
  guideLabelForRoute,
  HOME_ROUTE,
  HOW_IT_WORKS_ROUTE,
  RevealSection,
  useSeoRouteHead,
} from './shared'

// Shared inline guide links for internal linking blocks.
const GUIDE_LINKS = GUIDE_SEO_ROUTES

export function GuideRoutePage({ routeId }: { routeId: string }) {
  const route = getSeoRouteById(routeId)
  useSeoRouteHead(route.canonicalPath)

  if (route.template === 'compatibility') {
    return (
      <div class="how-it-works">
        <a class="how-back-link" href={HOME_ROUTE.routerPath}>
          <ArrowLeftIcon />
          Back to HDR PNG Converter
        </a>
        <section class="how-hero">
          <h1>{route.guideHeading ?? guideLabelForRoute(route)}</h1>
          <p>{route.guideIntro ?? route.description}</p>
        </section>
        <RevealSection className="how-section">
          <h2>Current Support Snapshot</h2>
          <BrowserCompat />
        </RevealSection>
        <RevealSection className="how-section">
          <h2>Implementation Notes</h2>
          <ul class="how-meta-list">
            <li>Chrome and Edge use cICP signaling for HDR rendering.</li>
            <li>Safari on macOS uses ICC metadata for EDR display behavior.</li>
            <li>On SDR displays, files still render as standard PNG images.</li>
          </ul>
        </RevealSection>
        <RevealSection className="how-section">
          <h2>Related Guides</h2>
          <ul class="how-meta-list">
            <li>
              <a href={HOW_IT_WORKS_ROUTE.routerPath}>How HDR PNG conversion works</a>
            </li>
            {FORMAT_GUIDE_ROUTES.map((formatRoute) => (
              <li key={formatRoute.id}>
                <a href={formatRoute.routerPath}>{guideLabelForRoute(formatRoute)}</a>
              </li>
            ))}
          </ul>
        </RevealSection>
      </div>
    )
  }

  const heading = route.guideHeading ?? guideLabelForRoute(route)
  const intro = route.guideIntro ?? route.description
  const details =
    route.guideDetails ??
    'Supernova decodes source pixels, applies calibrated color transforms, and exports 16-bit HDR PNG with PQ and BT.2020 metadata.'

  return (
    <div class="how-it-works">
      <a class="how-back-link" href={HOME_ROUTE.routerPath}>
        <ArrowLeftIcon />
        Back to HDR PNG Converter
      </a>
      <section class="how-hero">
        <h1>{heading}</h1>
        <p>{intro}</p>
      </section>
      <RevealSection className="how-section">
        <h2>How Supernova Handles This Format</h2>
        <p>{details}</p>
        <ul class="how-meta-list">
          <li>Process locally in your browser with no uploads.</li>
          <li>Preview edits with a fast SDR approximation.</li>
          <li>Export 16-bit HDR PNG using PQ and BT.2020 metadata.</li>
        </ul>
      </RevealSection>
      <RevealSection className="how-section">
        <h2>Related Pages</h2>
        <ul class="how-meta-list">
          <li>
            <a href={HOW_IT_WORKS_ROUTE.routerPath}>How HDR PNG conversion works</a>
          </li>
          {GUIDE_LINKS.filter((guideRoute) => guideRoute.id !== route.id).map((guideRoute) => (
            <li key={guideRoute.id}>
              <a href={guideRoute.routerPath}>{guideLabelForRoute(guideRoute)}</a>
            </li>
          ))}
        </ul>
      </RevealSection>
    </div>
  )
}

export const GUIDE_ROUTE_COMPONENT_BY_ID = new Map(
  GUIDE_SEO_ROUTES.map((route) => [route.id, () => <GuideRoutePage routeId={route.id} />] as const),
)
