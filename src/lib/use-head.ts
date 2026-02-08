import { useEffect } from 'preact/hooks'
import { canonicalUrlForPath, SEO_TWITTER_SITE } from './seo-routes'

interface HeadElement {
  type: string
  props: Record<string, string>
}

interface HeadData {
  title: string
  elements: HeadElement[]
}

interface HeadOptions {
  robots?: string
}

let ssrHead: HeadData | null = null

export function startHeadCollection(): void {
  ssrHead = { title: '', elements: [] }
}

export function flushHead(): HeadData | null {
  const head = ssrHead
  ssrHead = null
  return head
}

export function useHead(title: string, description: string, canonicalPath: string, options?: HeadOptions) {
  const canonicalUrl = canonicalUrlForPath(canonicalPath)
  const robots = options?.robots ?? 'index,follow'

  if (ssrHead) {
    ssrHead.title = title
    ssrHead.elements.push({ type: 'meta', props: { name: 'description', content: description } })
    ssrHead.elements.push({ type: 'link', props: { rel: 'canonical', href: canonicalUrl } })
    ssrHead.elements.push({ type: 'meta', props: { name: 'robots', content: robots } })
    ssrHead.elements.push({ type: 'meta', props: { property: 'og:title', content: title } })
    ssrHead.elements.push({ type: 'meta', props: { property: 'og:description', content: description } })
    ssrHead.elements.push({ type: 'meta', props: { property: 'og:url', content: canonicalUrl } })
    ssrHead.elements.push({ type: 'meta', props: { name: 'twitter:title', content: title } })
    ssrHead.elements.push({ type: 'meta', props: { name: 'twitter:description', content: description } })
    if (SEO_TWITTER_SITE) {
      ssrHead.elements.push({ type: 'meta', props: { name: 'twitter:site', content: SEO_TWITTER_SITE } })
    }
  }

  useEffect(() => {
    if (ssrHead) return
    document.title = title

    const updates: [string, string, string][] = [
      ['meta[name="description"]', 'content', description],
      ['link[rel="canonical"]', 'href', canonicalUrl],
      ['meta[name="robots"]', 'content', robots],
      ['meta[property="og:title"]', 'content', title],
      ['meta[property="og:description"]', 'content', description],
      ['meta[property="og:url"]', 'content', canonicalUrl],
      ['meta[name="twitter:title"]', 'content', title],
      ['meta[name="twitter:description"]', 'content', description],
    ]
    if (SEO_TWITTER_SITE) {
      updates.push(['meta[name="twitter:site"]', 'content', SEO_TWITTER_SITE])
    }

    for (const [selector, attr, value] of updates) {
      document.querySelector(selector)?.setAttribute(attr, value)
    }
  }, [title, description, canonicalUrl, robots])
}
