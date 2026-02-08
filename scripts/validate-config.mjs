import { readSeoRoutesConfig } from './seo-routes-utils.mjs'

const VALID_ROBOTS = new Set(['index,follow', 'noindex,nofollow'])
const VALID_TEMPLATES = new Set(['home', 'how-it-works', 'intent-guide', 'compatibility', 'not-found'])
const VALID_SCHEMA_PROFILES = new Set(['webapp', 'faq', 'none'])

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0
}

function isValidCanonicalPath(path) {
  if (!isNonEmptyString(path) || !path.startsWith('/')) return false
  if (path !== '/' && path.endsWith('/')) return false
  return true
}

function validateSiteConfig(siteConfig, issues) {
  const requiredStringFields = [
    'baseUrl',
    'siteName',
    'defaultDocumentTitle',
    'themeColor',
    'ogLocale',
    'ogImage',
    'ogImageAlt',
    'twitterCard',
    'faviconPath',
  ]
  for (const key of requiredStringFields) {
    if (!isNonEmptyString(siteConfig[key])) {
      issues.push(`site-config.json: "${key}" must be a non-empty string`)
    }
  }

  if (siteConfig.twitterSite !== null && typeof siteConfig.twitterSite !== 'string') {
    issues.push('site-config.json: "twitterSite" must be a string or null')
  }

  if (isNonEmptyString(siteConfig.baseUrl)) {
    try {
      const url = new URL(siteConfig.baseUrl)
      if (url.protocol !== 'https:') {
        issues.push('site-config.json: "baseUrl" must use https://')
      }
    } catch {
      issues.push('site-config.json: "baseUrl" must be a valid absolute URL')
    }
  }
}

function validateRoutes(routes, issues) {
  const ids = new Set()
  const canonicalPaths = new Set()
  const templateCounts = new Map()

  for (const route of routes) {
    if (!isNonEmptyString(route.id)) {
      issues.push('seo-routes.json: each route requires a non-empty "id"')
    } else if (ids.has(route.id)) {
      issues.push(`seo-routes.json: duplicate route id "${route.id}"`)
    } else {
      ids.add(route.id)
    }

    if (!isValidCanonicalPath(route.canonicalPath)) {
      issues.push(`seo-routes.json: invalid canonicalPath "${route.canonicalPath}"`)
    } else if (canonicalPaths.has(route.canonicalPath)) {
      issues.push(`seo-routes.json: duplicate canonicalPath "${route.canonicalPath}"`)
    } else {
      canonicalPaths.add(route.canonicalPath)
    }

    if (!VALID_TEMPLATES.has(route.template)) {
      issues.push(`seo-routes.json: invalid template "${route.template}" on route "${route.id}"`)
    } else {
      templateCounts.set(route.template, (templateCounts.get(route.template) ?? 0) + 1)
    }

    if (!VALID_ROBOTS.has(route.robots)) {
      issues.push(`seo-routes.json: invalid robots value "${route.robots}" on route "${route.id}"`)
    }

    if (!VALID_SCHEMA_PROFILES.has(route.schemaProfile)) {
      issues.push(`seo-routes.json: invalid schemaProfile "${route.schemaProfile}" on route "${route.id}"`)
    }

    if (!Array.isArray(route.lastmodSources) || route.lastmodSources.length === 0) {
      issues.push(`seo-routes.json: route "${route.id}" must define at least one lastmodSources entry`)
    }

    if (route.indexable === true && route.robots !== 'index,follow') {
      issues.push(`seo-routes.json: route "${route.id}" is indexable but robots is not index,follow`)
    }
    if (route.indexable === false && route.robots !== 'noindex,nofollow') {
      issues.push(`seo-routes.json: route "${route.id}" is non-indexable but robots is not noindex,nofollow`)
    }

    if (route.template === 'home' && route.schemaProfile !== 'webapp') {
      issues.push('seo-routes.json: home template must use schemaProfile "webapp"')
    }
    if (route.template === 'how-it-works' && route.schemaProfile !== 'faq') {
      issues.push('seo-routes.json: how-it-works template must use schemaProfile "faq"')
    }

    const isGuide = route.template === 'intent-guide' || route.template === 'compatibility'
    if (isGuide) {
      if (!isNonEmptyString(route.guideLabel)) {
        issues.push(`seo-routes.json: guide route "${route.id}" requires guideLabel`)
      }
      if (!isNonEmptyString(route.guideHeading)) {
        issues.push(`seo-routes.json: guide route "${route.id}" requires guideHeading`)
      }
      if (!isNonEmptyString(route.guideIntro)) {
        issues.push(`seo-routes.json: guide route "${route.id}" requires guideIntro`)
      }
      if (route.template === 'intent-guide' && !isNonEmptyString(route.guideDetails)) {
        issues.push(`seo-routes.json: intent-guide route "${route.id}" requires guideDetails`)
      }
    }
  }

  for (const template of ['home', 'how-it-works', 'not-found']) {
    const count = templateCounts.get(template) ?? 0
    if (count !== 1) {
      issues.push(`seo-routes.json: expected exactly one route for template "${template}", found ${count}`)
    }
  }
}

async function main() {
  const { siteConfig, routes } = await readSeoRoutesConfig()
  const issues = []

  validateSiteConfig(siteConfig, issues)
  validateRoutes(routes, issues)

  if (issues.length > 0) {
    console.error('[validate-config] Configuration validation failed:')
    for (const issue of issues) {
      console.error(`- ${issue}`)
    }
    process.exit(1)
  }

  console.log('[validate-config] Site and SEO route config are valid.')
}

main().catch((error) => {
  console.error(`[validate-config] ${error.message}`)
  process.exit(1)
})
