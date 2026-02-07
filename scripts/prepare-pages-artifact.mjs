import { access, copyFile, cp, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url))
const ROOT_DIR = path.resolve(SCRIPT_DIR, '..')
const DIST_DIR = path.join(ROOT_DIR, 'dist')
const NESTED_DIR = path.join(DIST_DIR, 'supernova-image')
const INDEX_HTML = path.join(DIST_DIR, 'index.html')
const ROUTE_404_INDEX_HTML = path.join(DIST_DIR, '404', 'index.html')
const NOT_FOUND_HTML = path.join(DIST_DIR, '404.html')

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

async function ensureNotFoundPage() {
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
  const patchedHtml = html
    .replace(/<title>.*?<\/title>/, '<title>Page Not Found | Supernova HDR PNG Converter</title>')
    .replace(/<link rel="canonical" href="[^"]*">/, '<link rel="canonical" href="https://zjsng.github.io/supernova-image/404">')
    .replace(/<meta name="robots" content="[^"]*">/, '<meta name="robots" content="noindex,nofollow">')

  await writeFile(NOT_FOUND_HTML, patchedHtml)
  console.log('[prepare-pages-artifact] Wrote dist/404.html from dist/index.html with noindex fallback metadata.')
}

async function main() {
  if (!(await exists(DIST_DIR))) {
    throw new Error('Missing dist/ directory. Run the build before preparing the Pages artifact.')
  }

  await copyNestedBuildOutput()
  await ensureNotFoundPage()
}

main().catch((error) => {
  console.error(`[prepare-pages-artifact] ${error.message}`)
  process.exit(1)
})
