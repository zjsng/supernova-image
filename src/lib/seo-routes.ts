import seoRoutesConfig from './seo-routes.json'

export type SeoSchemaProfile = 'webapp' | 'faq' | 'none'

export interface SeoRouteMeta {
  id: string
  canonicalPath: string
  routerPath: string
  title: string
  description: string
  robots: 'index,follow' | 'noindex,nofollow'
  indexable: boolean
  schemaProfile: SeoSchemaProfile
  lastmodSources: string[]
}

interface SeoRoutesConfig {
  baseUrl: string
  ogImage: string
  ogImageAlt: string
  ogLocale: string
  twitterCard: string
  twitterSite: string | null
  routes: SeoRouteMeta[]
}

const config = seoRoutesConfig as SeoRoutesConfig

export const SEO_BASE_URL = config.baseUrl
export const SEO_OG_IMAGE = config.ogImage
export const SEO_OG_IMAGE_ALT = config.ogImageAlt
export const SEO_OG_LOCALE = config.ogLocale
export const SEO_TWITTER_CARD = config.twitterCard
export const SEO_TWITTER_SITE = config.twitterSite

export const SEO_ROUTES = config.routes

export const SEO_ROUTE_BY_CANONICAL_PATH = new Map(
  SEO_ROUTES.map((route) => [route.canonicalPath, route] as const),
)

export const SEO_ROUTE_BY_ROUTER_PATH = new Map(
  SEO_ROUTES.map((route) => [route.routerPath, route] as const),
)

export function getSeoRouteByCanonicalPath(canonicalPath: string): SeoRouteMeta {
  const route = SEO_ROUTE_BY_CANONICAL_PATH.get(canonicalPath)
  if (!route) {
    throw new Error(`Unknown SEO route for canonical path: ${canonicalPath}`)
  }
  return route
}

export function hrefForCanonicalPath(canonicalPath: string): string {
  return getSeoRouteByCanonicalPath(canonicalPath).routerPath
}

export function canonicalUrlForPath(canonicalPath: string): string {
  const route = getSeoRouteByCanonicalPath(canonicalPath)
  if (route.canonicalPath === '/') {
    return `${SEO_BASE_URL}/`
  }
  return `${SEO_BASE_URL}${route.canonicalPath}`
}

export const ADDITIONAL_PRERENDER_ROUTES = SEO_ROUTES
  .filter((route) => route.routerPath !== '/supernova-image/')
  .map((route) => route.routerPath)

export const INDEXABLE_SEO_ROUTES = SEO_ROUTES.filter((route) => route.indexable)
