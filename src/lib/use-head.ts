import { useEffect } from 'preact/hooks'

export function useHead(title: string, description?: string) {
  useEffect(() => {
    document.title = title
    if (description) {
      document.querySelector('meta[name="description"]')?.setAttribute('content', description)
    }
  }, [title, description])
}
