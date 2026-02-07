import { useEffect } from 'preact/hooks'

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

const BASE_URL = 'https://zjsng.github.io/supernova-image'

export function useHead(title: string, description: string, canonicalPath: string, options?: HeadOptions) {
  const canonicalUrl = `${BASE_URL}${canonicalPath}`
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
    return
  }

  useEffect(() => {
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

    for (const [selector, attr, value] of updates) {
      document.querySelector(selector)?.setAttribute(attr, value)
    }
  }, [title, description, canonicalUrl, robots])
}
