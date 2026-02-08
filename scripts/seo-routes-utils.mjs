import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url))
export const ROOT_DIR = path.resolve(SCRIPT_DIR, '..')
export const DIST_DIR = path.join(ROOT_DIR, 'dist')
export const SEO_ROUTES_CONFIG = path.join(ROOT_DIR, 'src', 'lib', 'seo-routes.json')
export const SITE_CONFIG = path.join(ROOT_DIR, 'src', 'lib', 'site-config.json')

export function canonicalUrl(baseUrl, canonicalPath) {
  if (canonicalPath === '/') return `${baseUrl}/`
  return `${baseUrl}${canonicalPath}`
}

export function htmlPathForCanonicalPath(canonicalPath) {
  if (canonicalPath === '/') return path.join(DIST_DIR, 'index.html')
  if (canonicalPath === '/404') return path.join(DIST_DIR, '404.html')
  return path.join(DIST_DIR, canonicalPath.slice(1), 'index.html')
}

export async function readSeoRoutesConfig() {
  const [routesRaw, siteRaw] = await Promise.all([readFile(SEO_ROUTES_CONFIG, 'utf8'), readFile(SITE_CONFIG, 'utf8')])
  const routeConfig = JSON.parse(routesRaw)
  const siteConfig = JSON.parse(siteRaw)
  const routes = Array.isArray(routeConfig.routes) ? routeConfig.routes : []
  const baseUrl = String(siteConfig.baseUrl ?? '')
  if (!baseUrl || routes.length === 0) {
    throw new Error('Missing baseUrl in src/lib/site-config.json or routes in src/lib/seo-routes.json')
  }
  return { siteConfig, baseUrl, routes }
}
