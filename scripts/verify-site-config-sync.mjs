import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { ROOT_DIR, readSeoRoutesConfig } from './seo-routes-utils.mjs'

const INDEX_HTML = path.join(ROOT_DIR, 'src', 'index.html')

function capture(html, regex) {
  const match = html.match(regex)
  return match?.[1] ?? ''
}

function assertEqual(label, actual, expected, issues) {
  if (actual !== expected) {
    issues.push(`${label} mismatch: expected "${expected}", got "${actual || '(empty)'}"`)
  }
}

async function main() {
  const { siteConfig } = await readSeoRoutesConfig()
  const html = await readFile(INDEX_HTML, 'utf8')
  const issues = []

  const title = capture(html, /<title>([^<]*)<\/title>/i)
  const themeColor = capture(html, /<meta name="theme-color" content="([^"]*)"\s*\/?>/i)
  const ogLocale = capture(html, /<meta property="og:locale" content="([^"]*)"\s*\/?>/i)
  const ogSiteName = capture(html, /<meta property="og:site_name" content="([^"]*)"\s*\/?>/i)
  const ogImage = capture(html, /<meta property="og:image" content="([^"]*)"\s*\/?>/i)
  const ogImageAlt = capture(html, /<meta property="og:image:alt" content="([^"]*)"\s*\/?>/i)
  const twitterCard = capture(html, /<meta name="twitter:card" content="([^"]*)"\s*\/?>/i)
  const twitterImage = capture(html, /<meta name="twitter:image" content="([^"]*)"\s*\/?>/i)
  const twitterImageAlt = capture(html, /<meta name="twitter:image:alt" content="([^"]*)"\s*\/?>/i)
  const faviconPath = capture(html, /<link rel="icon" type="image\/svg\+xml" href="([^"]*)"\s*\/?>/i)

  assertEqual('title', title, siteConfig.defaultDocumentTitle, issues)
  assertEqual('theme-color', themeColor, siteConfig.themeColor, issues)
  assertEqual('og:locale', ogLocale, siteConfig.ogLocale, issues)
  assertEqual('og:site_name', ogSiteName, siteConfig.siteName, issues)
  assertEqual('og:image', ogImage, siteConfig.ogImage, issues)
  assertEqual('og:image:alt', ogImageAlt, siteConfig.ogImageAlt, issues)
  assertEqual('twitter:card', twitterCard, siteConfig.twitterCard, issues)
  assertEqual('twitter:image', twitterImage, siteConfig.ogImage, issues)
  assertEqual('twitter:image:alt', twitterImageAlt, siteConfig.ogImageAlt, issues)
  assertEqual('favicon', faviconPath, siteConfig.faviconPath, issues)

  if (issues.length > 0) {
    console.error('[verify-site-config-sync] src/index.html is out of sync with src/lib/site-config.json:')
    for (const issue of issues) {
      console.error(`- ${issue}`)
    }
    process.exit(1)
  }

  console.log('[verify-site-config-sync] src/index.html matches src/lib/site-config.json.')
}

main().catch((error) => {
  console.error(`[verify-site-config-sync] ${error.message}`)
  process.exit(1)
})
