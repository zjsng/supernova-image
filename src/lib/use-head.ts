import { useEffect } from 'preact/hooks'

interface HeadElement {
  type: string
  props: Record<string, string>
}

interface HeadData {
  title: string
  elements: Set<HeadElement>
}

let ssrHead: HeadData | null = null

export function startHeadCollection(): void {
  ssrHead = { title: '', elements: new Set() }
}

export function flushHead(): HeadData | null {
  const head = ssrHead
  ssrHead = null
  return head
}

const BASE_URL = 'https://zjsng.github.io/supernova-image'

export function useHead(title: string, description: string, canonicalPath: string) {
  const canonicalUrl = `${BASE_URL}${canonicalPath}`

  if (ssrHead) {
    ssrHead.title = title
    ssrHead.elements.add({ type: 'meta', props: { name: 'description', content: description } })
    ssrHead.elements.add({ type: 'link', props: { rel: 'canonical', href: canonicalUrl } })
    ssrHead.elements.add({ type: 'meta', props: { property: 'og:title', content: title } })
    ssrHead.elements.add({ type: 'meta', props: { property: 'og:description', content: description } })
    ssrHead.elements.add({ type: 'meta', props: { property: 'og:url', content: canonicalUrl } })
    ssrHead.elements.add({ type: 'meta', props: { name: 'twitter:title', content: title } })
    ssrHead.elements.add({ type: 'meta', props: { name: 'twitter:description', content: description } })
    return
  }

  useEffect(() => {
    document.title = title

    const updates: [string, string, string][] = [
      ['meta[name="description"]', 'content', description],
      ['link[rel="canonical"]', 'href', canonicalUrl],
      ['meta[property="og:title"]', 'content', title],
      ['meta[property="og:description"]', 'content', description],
      ['meta[property="og:url"]', 'content', canonicalUrl],
      ['meta[name="twitter:title"]', 'content', title],
      ['meta[name="twitter:description"]', 'content', description],
    ]

    for (const [selector, attr, value] of updates) {
      document.querySelector(selector)?.setAttribute(attr, value)
    }
  }, [title, description, canonicalUrl])
}
