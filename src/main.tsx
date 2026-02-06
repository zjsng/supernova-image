import { hydrate, prerender as prerenderIso } from 'preact-iso'
import { App } from './app'
import './app.css'

if (typeof window !== 'undefined') {
  hydrate(<App />, document.getElementById('app')!)
}

export async function prerender(data: { url: string }) {
  return prerenderIso(<App />)
}
