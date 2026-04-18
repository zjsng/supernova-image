import { ArrowLeftIcon, HOME_ROUTE, NOT_FOUND_ROUTE, useSeoRouteHead } from './shared'

export function NotFound() {
  useSeoRouteHead(NOT_FOUND_ROUTE.canonicalPath)

  return (
    <div class="not-found">
      <div class="not-found__star" aria-hidden="true" />
      <span class="not-found__eyebrow">✦ 404 · Photon lost in transit</span>
      <h1>Signal Lost</h1>
      <p>This page drifted beyond the visible spectrum. Nothing was uploaded, nothing was lost — just the route.</p>
      <a class="not-found__link" href={HOME_ROUTE.routerPath}>
        <ArrowLeftIcon />
        Back to the converter
      </a>
      <span class="not-found__trace">trace · 0x7F3A · no route matched</span>
    </div>
  )
}
