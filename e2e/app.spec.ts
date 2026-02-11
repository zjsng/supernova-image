import { expect, test, type Page } from '@playwright/test'
import path from 'node:path'

const fixturePath = path.resolve(process.cwd(), 'e2e/fixtures/test.png')

async function getPreviewFingerprint(page: Page): Promise<string | null> {
  const previewImage = page.locator('img.preview-output-image')
  if ((await previewImage.count()) > 0) {
    return previewImage.evaluate((image) =>
      image.complete && image.naturalWidth > 0 ? `img:${image.currentSrc || image.src}` : null,
    )
  }

  const previewCanvas = page.locator('canvas.preview-output-canvas')
  if ((await previewCanvas.count()) > 0) {
    return previewCanvas.evaluate((canvas) => (canvas.width > 0 && canvas.height > 0 ? `canvas:${canvas.toDataURL()}` : null))
  }

  return null
}

async function waitForPreviewReady(page: Page): Promise<string> {
  const previewPlaceholder = page.getByText('Adjust controls to render preview')
  await expect(previewPlaceholder).toBeHidden()
  await expect(page.locator('.processing-overlay')).toBeHidden()

  let fingerprint: string | null = null
  await expect
    .poll(
      async () => {
        fingerprint = await getPreviewFingerprint(page)
        return fingerprint
      },
      { timeout: 15_000 },
    )
    .not.toBeNull()

  await expect(page.locator('.processing-overlay')).toBeHidden()
  return fingerprint as string
}

test('core routes render expected content', async ({ page }) => {
  await page.goto('./')
  await expect(page.getByRole('heading', { name: 'HDR PNG Converter' })).toBeVisible()

  await page.goto('how-it-works')
  await expect(page.getByRole('heading', { name: 'How HDR PNG Conversion Works' })).toBeVisible()

  await page.goto('does-not-exist')
  await expect(page.getByRole('heading', { name: 'Signal Lost' })).toBeVisible()
})

test('upload, preview update, and download flow works', async ({ page }) => {
  await page.goto('./')

  const fileInput = page.locator('input[type="file"]')
  await fileInput.setInputFiles(fixturePath)

  await expect(page.locator('.filename')).toContainText('test.png', { timeout: 15_000 })

  const initialPreview = await waitForPreviewReady(page)

  await page.locator('#saturation-range').evaluate((el) => {
    const input = el as HTMLInputElement
    input.value = '1.6'
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
  await expect(page.locator('#saturation-range')).toHaveValue('1.6')

  await expect
    .poll(
      async () => {
        const nextPreview = await getPreviewFingerprint(page)
        return nextPreview !== null && nextPreview !== initialPreview
      },
      { timeout: 15_000 },
    )
    .toBe(true)
  await expect(page.locator('.processing-overlay')).toBeHidden()

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Download HDR PNG' }).click(),
  ])
  expect(download.suggestedFilename()).toMatch(/-hdr\.png$/)
})
