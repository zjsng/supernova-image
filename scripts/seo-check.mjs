import { access, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { canonicalUrl, DIST_DIR, htmlPathForCanonicalPath, ROOT_DIR, readSeoRoutesConfig } from './seo-routes-utils.mjs'

const SEO_REPORT_PATH = path.join(DIST_DIR, 'seo-audit.json')

async function exists(filePath) {
  try {
    await access(filePath)
    return true
  } catch {
    return false
  }
}

function capture(html, regex) {
  const match = html.match(regex)
  return match?.[1] ?? ''
}

function extractPageFields(html) {
  return {
    title: capture(html, /<title>([^<]*)<\/title>/i),
    description: capture(html, /<meta name="description" content="([^"]*)">/i),
    canonical: capture(html, /<link rel="canonical" href="([^"]*)">/i),
    robots: capture(html, /<meta name="robots" content="([^"]*)">/i),
  }
}

function parseSitemapUrls(xml) {
  const urls = []
  const regex = /<loc>([^<]+)<\/loc>/g
  let match = regex.exec(xml)
  while (match) {
    urls.push(match[1])
    match = regex.exec(xml)
  }
  return urls
}

async function run() {
  const { routes, baseUrl } = await readSeoRoutesConfig()
  const issues = []
  const pageResults = []

  for (const route of routes) {
    const htmlPath = htmlPathForCanonicalPath(route.canonicalPath)
    const routeIssues = []
    const hasFile = await exists(htmlPath)
    if (!hasFile) {
      routeIssues.push(`Missing built HTML for ${route.canonicalPath}: ${path.relative(ROOT_DIR, htmlPath)}`)
      pageResults.push({
        canonicalPath: route.canonicalPath,
        htmlPath: path.relative(ROOT_DIR, htmlPath),
        titlePresent: false,
        descriptionPresent: false,
        canonicalMatch: false,
        robotsMatch: false,
        issues: routeIssues,
      })
      issues.push(...routeIssues)
      continue
    }

    const html = await readFile(htmlPath, 'utf8')
    const fields = extractPageFields(html)
    const expectedCanonical = canonicalUrl(baseUrl, route.canonicalPath)
    const expectedRobots = String(route.robots ?? '')

    if (!fields.title) routeIssues.push(`Missing title tag for ${route.canonicalPath}`)
    if (!fields.description) routeIssues.push(`Missing meta description for ${route.canonicalPath}`)
    if (fields.canonical !== expectedCanonical) {
      routeIssues.push(`Canonical mismatch for ${route.canonicalPath}: expected ${expectedCanonical}, got ${fields.canonical || '(empty)'}`)
    }
    if (fields.robots !== expectedRobots) {
      routeIssues.push(`Robots mismatch for ${route.canonicalPath}: expected ${expectedRobots}, got ${fields.robots || '(empty)'}`)
    }

    pageResults.push({
      canonicalPath: route.canonicalPath,
      htmlPath: path.relative(ROOT_DIR, htmlPath),
      titlePresent: Boolean(fields.title),
      descriptionPresent: Boolean(fields.description),
      canonicalMatch: fields.canonical === expectedCanonical,
      robotsMatch: fields.robots === expectedRobots,
      issues: routeIssues,
    })
    issues.push(...routeIssues)
  }

  const expectedSitemapUrls = routes.filter((route) => route.indexable).map((route) => canonicalUrl(baseUrl, route.canonicalPath))
  const sitemapPath = path.join(DIST_DIR, 'sitemap.xml')
  const sitemapXml = await readFile(sitemapPath, 'utf8')
  const foundSitemapUrls = parseSitemapUrls(sitemapXml)
  const missingUrls = expectedSitemapUrls.filter((url) => !foundSitemapUrls.includes(url))
  const unexpectedUrls = foundSitemapUrls.filter((url) => !expectedSitemapUrls.includes(url))

  for (const url of missingUrls) {
    issues.push(`Sitemap missing expected URL: ${url}`)
  }
  for (const url of unexpectedUrls) {
    issues.push(`Sitemap contains unexpected URL: ${url}`)
  }

  const report = {
    generatedAt: new Date().toISOString(),
    success: issues.length === 0,
    checks: {
      pages: pageResults,
      sitemap: {
        expectedUrls: expectedSitemapUrls,
        foundUrls: foundSitemapUrls,
        missingUrls,
        unexpectedUrls,
      },
    },
    issues,
  }

  await writeFile(SEO_REPORT_PATH, JSON.stringify(report, null, 2), 'utf8')

  console.table(
    pageResults.map((page) => ({
      route: page.canonicalPath,
      title: page.titlePresent ? 'ok' : 'missing',
      description: page.descriptionPresent ? 'ok' : 'missing',
      canonical: page.canonicalMatch ? 'ok' : 'mismatch',
      robots: page.robotsMatch ? 'ok' : 'mismatch',
      issues: page.issues.length,
    })),
  )

  console.log(`[seo-check] Wrote ${path.relative(ROOT_DIR, SEO_REPORT_PATH)}`)
  if (issues.length > 0) {
    console.error('[seo-check] Failed with issues:')
    for (const issue of issues) console.error(`- ${issue}`)
    process.exit(1)
  }
  console.log('[seo-check] Passed.')
}

run().catch((error) => {
  console.error(`[seo-check] ${error.message}`)
  process.exit(1)
})
