import { access, copyFile, cp, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { canonicalUrl, ROOT_DIR, DIST_DIR, readSeoRoutesConfig } from './seo-routes-utils.mjs'

const NESTED_DIR = path.join(DIST_DIR, 'supernova-image')
const INDEX_HTML = path.join(DIST_DIR, 'index.html')
const ROUTE_404_INDEX_HTML = path.join(DIST_DIR, '404', 'index.html')
const NOT_FOUND_HTML = path.join(DIST_DIR, '404.html')
const SITEMAP_XML = path.join(DIST_DIR, 'sitemap.xml')
const ROBOTS_TXT = path.join(DIST_DIR, 'robots.txt')

async function exists(filePath) {
  try {
    await access(filePath)
    return true
  } catch {
    return false
  }
}

async function copyNestedBuildOutput() {
  if (!(await exists(NESTED_DIR))) {
    console.log('[prepare-pages-artifact] No dist/supernova-image directory found; skipping flatten step.')
    return
  }

  const entries = await readdir(NESTED_DIR, { withFileTypes: true })
  for (const entry of entries) {
    const src = path.join(NESTED_DIR, entry.name)
    const dest = path.join(DIST_DIR, entry.name)
    await cp(src, dest, { recursive: entry.isDirectory(), force: true })
  }

  await rm(NESTED_DIR, { recursive: true, force: true })
  console.log('[prepare-pages-artifact] Flattened dist/supernova-image into dist/.')
}

function getNotFoundRoute(routes) {
  const route = routes.find((candidate) => candidate.canonicalPath === '/404')
  if (!route) {
    throw new Error('Missing /404 route in src/lib/seo-routes.json.')
  }
  return route
}

async function ensureNotFoundPage(baseUrl, notFoundRoute) {
  if (!(await exists(INDEX_HTML))) {
    throw new Error('Missing dist/index.html after build; cannot create dist/404.html.')
  }

  if (await exists(ROUTE_404_INDEX_HTML)) {
    await copyFile(ROUTE_404_INDEX_HTML, NOT_FOUND_HTML)
    console.log('[prepare-pages-artifact] Wrote dist/404.html from dist/404/index.html.')
    return
  }

  await copyFile(INDEX_HTML, NOT_FOUND_HTML)
  const html = await readFile(NOT_FOUND_HTML, 'utf-8')
  const canonical404Url = canonicalUrl(baseUrl, notFoundRoute.canonicalPath)
  const title = notFoundRoute.title ?? 'Page Not Found'
  const description = notFoundRoute.description ?? 'This page could not be found.'
  const robots = notFoundRoute.robots ?? 'noindex,nofollow'
  const patchedHtml = html
    .replace(/<title>.*?<\/title>/, `<title>${title}</title>`)
    .replace(/<meta name="description" content="[^"]*">/, `<meta name="description" content="${description}">`)
    .replace(/<link rel="canonical" href="[^"]*">/, `<link rel="canonical" href="${canonical404Url}">`)
    .replace(/<meta name="robots" content="[^"]*">/, `<meta name="robots" content="${robots}">`)

  await writeFile(NOT_FOUND_HTML, patchedHtml)
  console.log('[prepare-pages-artifact] Wrote dist/404.html from dist/index.html with noindex fallback metadata.')
}

function asDateString(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null
}

function fallbackBuildDate() {
  return new Date().toISOString().slice(0, 10)
}

function lastModifiedForRoute(route, fallbackDate) {
  const sources = Array.isArray(route.lastmodSources) ? route.lastmodSources : []
  for (const source of sources) {
    try {
      const output = execFileSync('git', ['log', '-1', '--format=%cs', '--', source], {
        cwd: ROOT_DIR,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      }).trim()
      const normalized = asDateString(output)
      if (normalized) return normalized
    } catch {
      // Continue to fallback.
    }
  }
  return fallbackDate
}

async function writeSitemapFromSeoRoutes(baseUrl, routes) {
  const fallbackDate = fallbackBuildDate()
  const urls = routes
    .filter((route) => route.indexable)
    .map((route) => {
      const loc = canonicalUrl(baseUrl, route.canonicalPath)
      const lastmod = lastModifiedForRoute(route, fallbackDate)
      return `  <url>\n    <loc>${loc}</loc>\n    <lastmod>${lastmod}</lastmod>\n  </url>`
    })
    .join('\n')

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`
  await writeFile(SITEMAP_XML, xml, 'utf8')
  console.log(
    `[prepare-pages-artifact] Wrote dist/sitemap.xml from route metadata (${routes.filter((route) => route.indexable).length} URLs).`,
  )
}

async function writeRobotsTxt(baseUrl) {
  const body = `User-agent: *\nAllow: /\n\nSitemap: ${baseUrl}/sitemap.xml\n`
  await writeFile(ROBOTS_TXT, body, 'utf8')
  console.log('[prepare-pages-artifact] Wrote dist/robots.txt from site metadata.')
}

async function main() {
  if (!(await exists(DIST_DIR))) {
    throw new Error('Missing dist/ directory. Run the build before preparing the Pages artifact.')
  }

  const { baseUrl, routes } = await readSeoRoutesConfig()
  const notFoundRoute = getNotFoundRoute(routes)
  await copyNestedBuildOutput()
  await ensureNotFoundPage(baseUrl, notFoundRoute)
  await writeSitemapFromSeoRoutes(baseUrl, routes)
  await writeRobotsTxt(baseUrl)
}

main().catch((error) => {
  console.error(`[prepare-pages-artifact] ${error.message}`)
  process.exit(1)
})
