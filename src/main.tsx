import { hydrate, prerender as prerenderIso } from 'preact-iso'
import { locationStub } from 'preact-iso/prerender'
import { App } from './app'
import { startHeadCollection, flushHead } from './lib/use-head'
import '@fontsource/unbounded/latin-600.css'
import '@fontsource/unbounded/latin-700.css'
import '@fontsource/unbounded/latin-800.css'
import '@fontsource/outfit/latin-400.css'
import '@fontsource/outfit/latin-500.css'
import '@fontsource/outfit/latin-600.css'
import './app.css'

if (typeof window !== 'undefined') {
  hydrate(<App />, document.getElementById('app')!)
}

export async function prerender(data: { url: string }) {
  locationStub(data.url)
  startHeadCollection()
  const result = await prerenderIso(<App />)
  const head = flushHead()
  return { ...result, head }
}
