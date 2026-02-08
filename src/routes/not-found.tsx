import { ArrowLeftIcon, HOME_ROUTE, NOT_FOUND_ROUTE, useSeoRouteHead } from './shared'

export function NotFound() {
  useSeoRouteHead(NOT_FOUND_ROUTE.canonicalPath)

  return (
    <div class="not-found">
      <div class="not-found__star" aria-hidden="true" />
      <h1>Signal Lost</h1>
      <p>This page drifted beyond the visible spectrum.</p>
      <a class="not-found__link" href={HOME_ROUTE.routerPath}>
        <ArrowLeftIcon />
        Go to HDR PNG Converter
      </a>
    </div>
  )
}
