import { expect, test } from '@playwright/test'
import path from 'node:path'

const fixturePath = path.resolve(process.cwd(), 'e2e/fixtures/test.png')

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

  const previewPlaceholder = page.getByText('Adjust controls to render preview')
  await expect(previewPlaceholder).toBeHidden()

  const previewDataUrl = async (): Promise<string | null> => {
    const previewCanvas = page.locator('canvas.preview-output-canvas')
    const count = await previewCanvas.count()
    if (count === 0) return null
    return previewCanvas.evaluate((canvas) => (canvas.width > 0 && canvas.height > 0 ? canvas.toDataURL() : null))
  }
  let initialPreview: string | null = null
  await expect
    .poll(
      async () => {
        initialPreview = await previewDataUrl()
        return initialPreview
      },
      { timeout: 15_000 },
    )
    .not.toBeNull()

  await page.locator('#saturation-range').evaluate((el) => {
    const input = el as HTMLInputElement
    input.value = '1.6'
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })

  await expect(page.locator('.control-group .value').first()).toContainText('nits')

  await expect.poll(previewDataUrl, { timeout: 15_000 }).not.toBe(initialPreview)

  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Download HDR PNG' }).click()
  const download = await downloadPromise
  expect(download.suggestedFilename()).toMatch(/-hdr\.png$/)
})
