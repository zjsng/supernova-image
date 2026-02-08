import { access, readdir } from 'node:fs/promises'
import path from 'node:path'
import { DIST_DIR, htmlPathForCanonicalPath, ROOT_DIR, readSeoRoutesConfig } from './seo-routes-utils.mjs'

async function exists(filePath) {
  try {
    await access(filePath)
    return true
  } catch {
    return false
  }
}

async function listFiles(dir) {
  const files = []
  async function walk(current) {
    const entries = await readdir(current, { withFileTypes: true })
    for (const entry of entries) {
      const fullPath = path.join(current, entry.name)
      if (entry.isDirectory()) {
        await walk(fullPath)
      } else {
        files.push(path.relative(ROOT_DIR, fullPath))
      }
    }
  }
  await walk(dir)
  return files.sort()
}

async function main() {
  const { routes } = await readSeoRoutesConfig()

  if (routes.length === 0) {
    throw new Error('No routes found in src/lib/seo-routes.json')
  }

  const expectedFiles = new Set([
    'dist/robots.txt',
    'dist/sitemap.xml',
    'dist/seo-audit.json',
    ...routes.map((route) => path.relative(ROOT_DIR, htmlPathForCanonicalPath(route.canonicalPath))),
  ])

  let missing = 0
  for (const file of expectedFiles) {
    const fullPath = path.join(ROOT_DIR, file)
    if (!(await exists(fullPath))) {
      console.error(`Missing ${file}`)
      missing += 1
    }
  }

  if (missing > 0) {
    console.error('\nCurrent dist files:')
    const distFiles = await listFiles(DIST_DIR)
    for (const file of distFiles) {
      console.error(file)
    }
    process.exit(1)
  }

  console.log(`[verify-pages-artifact] Verified ${expectedFiles.size} required files from route metadata.`)
}

main().catch((error) => {
  console.error(`[verify-pages-artifact] ${error.message}`)
  process.exit(1)
})
