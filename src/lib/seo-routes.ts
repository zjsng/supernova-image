import seoRoutesConfig from './seo-routes.json'
import siteConfig from './site-config.json'

export type SeoSchemaProfile = 'webapp' | 'faq' | 'none'
export type SeoRouteTemplate = 'home' | 'how-it-works' | 'intent-guide' | 'compatibility' | 'not-found'

interface RawSeoRouteMeta {
  id: string
  canonicalPath: string
  template: SeoRouteTemplate
  guideLabel?: string
  guideHeading?: string
  guideIntro?: string
  guideDetails?: string
  title: string
  description: string
  robots: 'index,follow' | 'noindex,nofollow'
  indexable: boolean
  schemaProfile: SeoSchemaProfile
  lastmodSources: string[]
}

export interface SeoRouteMeta extends RawSeoRouteMeta {
  routerPath: string
}

interface SeoRoutesConfig {
  routes: RawSeoRouteMeta[]
}

interface SiteConfig {
  baseUrl: string
  siteName: string
  defaultDocumentTitle: string
  themeColor: string
  ogLocale: string
  ogImage: string
  ogImageAlt: string
  twitterCard: string
  twitterSite: string | null
  faviconPath: string
}

const config = seoRoutesConfig as SeoRoutesConfig
const sharedSiteConfig = siteConfig as SiteConfig

export const SITE_NAME = sharedSiteConfig.siteName
export const DEFAULT_DOCUMENT_TITLE = sharedSiteConfig.defaultDocumentTitle
export const THEME_COLOR = sharedSiteConfig.themeColor
export const FAVICON_PATH = sharedSiteConfig.faviconPath

export const SEO_BASE_URL = sharedSiteConfig.baseUrl
export const SEO_OG_IMAGE = sharedSiteConfig.ogImage
export const SEO_OG_IMAGE_ALT = sharedSiteConfig.ogImageAlt
export const SEO_OG_LOCALE = sharedSiteConfig.ogLocale
export const SEO_TWITTER_CARD = sharedSiteConfig.twitterCard
export const SEO_TWITTER_SITE = sharedSiteConfig.twitterSite

const SEO_BASE_PATH = new URL(SEO_BASE_URL).pathname.replace(/\/$/, '')

function routerPathFromCanonicalPath(canonicalPath: string): string {
  if (canonicalPath === '/') {
    return `${SEO_BASE_PATH}/`
  }
  return `${SEO_BASE_PATH}${canonicalPath}`
}

function collectDuplicateValues(values: string[]): string[] {
  const counts = new Map<string, number>()
  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1)
  }
  return [...counts.entries()].filter(([, count]) => count > 1).map(([value]) => value)
}

function assertSingleRouteForTemplate(template: SeoRouteTemplate): void {
  const matches = config.routes.filter((route) => route.template === template)
  if (matches.length !== 1) {
    throw new Error(`Expected exactly one SEO route for template "${template}", found ${matches.length}.`)
  }
}

assertSingleRouteForTemplate('home')
assertSingleRouteForTemplate('how-it-works')
assertSingleRouteForTemplate('not-found')

const duplicateIds = collectDuplicateValues(config.routes.map((route) => route.id))
if (duplicateIds.length > 0) {
  throw new Error(`Duplicate SEO route ids: ${duplicateIds.join(', ')}`)
}

const duplicateCanonicalPaths = collectDuplicateValues(config.routes.map((route) => route.canonicalPath))
if (duplicateCanonicalPaths.length > 0) {
  throw new Error(`Duplicate SEO canonical paths: ${duplicateCanonicalPaths.join(', ')}`)
}

export const SEO_ROUTES: SeoRouteMeta[] = config.routes.map((route) => ({
  ...route,
  routerPath: routerPathFromCanonicalPath(route.canonicalPath),
}))

export const SEO_ROUTE_BY_CANONICAL_PATH = new Map(SEO_ROUTES.map((route) => [route.canonicalPath, route] as const))

export const SEO_ROUTE_BY_ROUTER_PATH = new Map(SEO_ROUTES.map((route) => [route.routerPath, route] as const))

export const SEO_ROUTE_BY_ID = new Map(SEO_ROUTES.map((route) => [route.id, route] as const))

export function getSeoRouteByCanonicalPath(canonicalPath: string): SeoRouteMeta {
  const route = SEO_ROUTE_BY_CANONICAL_PATH.get(canonicalPath)
  if (!route) {
    throw new Error(`Unknown SEO route for canonical path: ${canonicalPath}`)
  }
  return route
}

export function getSeoRouteById(routeId: string): SeoRouteMeta {
  const route = SEO_ROUTE_BY_ID.get(routeId)
  if (!route) {
    throw new Error(`Unknown SEO route id: ${routeId}`)
  }
  return route
}

export function canonicalUrlForPath(canonicalPath: string): string {
  const route = getSeoRouteByCanonicalPath(canonicalPath)
  if (route.canonicalPath === '/') {
    return `${SEO_BASE_URL}/`
  }
  return `${SEO_BASE_URL}${route.canonicalPath}`
}

export const ADDITIONAL_PRERENDER_ROUTES = SEO_ROUTES.filter((route) => route.template !== 'home').map((route) => route.routerPath)

export const INDEXABLE_SEO_ROUTES = SEO_ROUTES.filter((route) => route.indexable)

export const GUIDE_SEO_ROUTES = SEO_ROUTES.filter((route) => route.template === 'intent-guide' || route.template === 'compatibility')

export function getSeoRoutesByTemplate(template: SeoRouteTemplate): SeoRouteMeta[] {
  return SEO_ROUTES.filter((route) => route.template === template)
}

export function getSingleSeoRouteByTemplate(template: SeoRouteTemplate): SeoRouteMeta {
  const matches = getSeoRoutesByTemplate(template)
  if (matches.length !== 1) {
    throw new Error(`Expected exactly one SEO route for template "${template}", found ${matches.length}.`)
  }
  return matches[0]!
}
