export interface SeoAuditPageResult {
  canonicalPath: string
  htmlPath: string
  titlePresent: boolean
  descriptionPresent: boolean
  canonicalMatch: boolean
  robotsMatch: boolean
  issues: string[]
}

export interface SeoAuditResult {
  generatedAt: string
  success: boolean
  checks: {
    pages: SeoAuditPageResult[]
    sitemap: {
      expectedUrls: string[]
      foundUrls: string[]
      missingUrls: string[]
      unexpectedUrls: string[]
    }
  }
  issues: string[]
}
