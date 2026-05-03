import { ConverterControls } from '../components/converter-controls'
import { PreviewPane } from '../components/preview-pane'
import { DeepFieldBackground } from '../components/deep-field-background'
import { SEO_BASE_URL } from '../lib/seo-routes'
import { HOME_ROUTE, RouteJsonLd, useSeoRouteHead } from './shared'
import { useConversionSession } from '../hooks/use-conversion-session'

export function Home() {
  useSeoRouteHead(HOME_ROUTE.canonicalPath)
  const session = useConversionSession()
  const {
    image,
    boost,
    lookControls,
    processing,
    downloaded,
    dragover,
    previewPending,
    previewReady,
    previewImageSrc,
    hdrPreviewEnabled,
    errorMessage,
    decodeCanvasRef,
    previewCanvasRef,
    fileInputRef,
    setBoost,
    setLookControl,
    reset,
    convert,
    handleDrop,
    handleDragOver,
    handleDragLeave,
    handleBrowse,
    handleFileSelect,
  } = session

  const previewPane = (
    <PreviewPane
      image={image}
      dragover={dragover}
      previewReady={previewReady}
      previewImageSrc={previewImageSrc}
      processing={processing}
      previewPending={previewPending}
      fileInputRef={fileInputRef}
      previewCanvasRef={previewCanvasRef}
      decodeCanvasRef={decodeCanvasRef}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onBrowse={handleBrowse}
      onFileSelect={handleFileSelect}
      imageName={image?.name}
      imageWidth={image?.width}
      imageHeight={image?.height}
      boost={boost}
      exposure={lookControls.exposure}
    />
  )

  return (
    <div
      class="prism-home"
      onDragOver={!image ? handleDragOver : undefined}
      onDragLeave={!image ? handleDragLeave : undefined}
      onDrop={!image ? handleDrop : undefined}
    >
      <DeepFieldBackground />
      <div class="grain-overlay" aria-hidden="true" />

      <div class="prism-home__content">
        {image ? (
          <div class="preview-layout">
            {previewPane}
            <ConverterControls
              imageName={image.name}
              imageWidth={image.width}
              imageHeight={image.height}
              boost={boost}
              lookControls={lookControls}
              processing={processing}
              downloaded={downloaded}
              hdrPreviewEnabled={hdrPreviewEnabled}
              onSetBoost={setBoost}
              onSetLookControl={setLookControl}
              onReset={reset}
              onConvert={convert}
            />
          </div>
        ) : (
          <section class="hero">{previewPane}</section>
        )}

        {errorMessage && (
          <div class="error-banner" role="alert">
            <span class="error-banner__icon" aria-hidden="true">
              ⚠
            </span>
            <span class="error-banner__message">{errorMessage}</span>
          </div>
        )}

        <RouteJsonLd
          data={{
            '@context': 'https://schema.org',
            '@graph': [
              {
                '@type': 'WebApplication',
                name: 'Supernova',
                description: 'Convert any image to HDR PNG in your browser',
                url: `${SEO_BASE_URL}/`,
                mainEntityOfPage: `${SEO_BASE_URL}/`,
                applicationCategory: 'MultimediaApplication',
                operatingSystem: 'Any',
                browserRequirements: 'Modern browser with HDR display recommended',
                offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
              },
              {
                '@type': 'WebSite',
                name: 'Supernova',
                url: `${SEO_BASE_URL}/`,
              },
              {
                '@type': 'Organization',
                name: 'Supernova',
                url: `${SEO_BASE_URL}/`,
                logo: `${SEO_BASE_URL}/og-image.png`,
              },
            ],
          }}
        />
      </div>
    </div>
  )
}
