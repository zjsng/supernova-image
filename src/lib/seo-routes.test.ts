import { describe, expect, it } from 'vitest'
import siteConfig from './site-config.json'
import {
  DEFAULT_DOCUMENT_TITLE,
  FAVICON_PATH,
  INDEXABLE_SEO_ROUTES,
  SEO_BASE_URL,
  SEO_OG_IMAGE,
  SEO_OG_IMAGE_ALT,
  SEO_OG_LOCALE,
  SEO_TWITTER_CARD,
  SEO_TWITTER_SITE,
  SITE_NAME,
  THEME_COLOR,
  canonicalUrlForPath,
  getSingleSeoRouteByTemplate,
} from './seo-routes'

describe('seo-routes contract', () => {
  it('keeps runtime constants aligned with site-config SSOT', () => {
    expect(SITE_NAME).toBe(siteConfig.siteName)
    expect(DEFAULT_DOCUMENT_TITLE).toBe(siteConfig.defaultDocumentTitle)
    expect(THEME_COLOR).toBe(siteConfig.themeColor)
    expect(FAVICON_PATH).toBe(siteConfig.faviconPath)
    expect(SEO_BASE_URL).toBe(siteConfig.baseUrl)
    expect(SEO_OG_IMAGE).toBe(siteConfig.ogImage)
    expect(SEO_OG_IMAGE_ALT).toBe(siteConfig.ogImageAlt)
    expect(SEO_OG_LOCALE).toBe(siteConfig.ogLocale)
    expect(SEO_TWITTER_CARD).toBe(siteConfig.twitterCard)
    expect(SEO_TWITTER_SITE).toBe(siteConfig.twitterSite)
  })

  it('keeps 404 noindex and out of indexable routes', () => {
    const notFoundRoute = getSingleSeoRouteByTemplate('not-found')
    expect(notFoundRoute.robots).toBe('noindex,nofollow')
    expect(INDEXABLE_SEO_ROUTES.some((route) => route.id === notFoundRoute.id)).toBe(false)
  })

  it('keeps canonical URLs self-consistent for key routes', () => {
    const home = getSingleSeoRouteByTemplate('home')
    const howItWorks = getSingleSeoRouteByTemplate('how-it-works')

    expect(canonicalUrlForPath(home.canonicalPath)).toBe(`${SEO_BASE_URL}/`)
    expect(canonicalUrlForPath(howItWorks.canonicalPath)).toBe(`${SEO_BASE_URL}${howItWorks.canonicalPath}`)
  })
})
