/** Same Google Sans family as gdgmedan.com (files mirrored under /fonts). */
export const GOOGLE_SANS_FONT_FAMILY = 'Google Sans'

export const GOOGLE_SANS_FONT_URLS = {
  regular: '/fonts/GoogleSans-Regular.ttf',
  medium: '/fonts/GoogleSans-Medium.ttf',
  bold: '/fonts/GoogleSans-Bold.ttf',
  italic: '/fonts/GoogleSans-Italic.ttf',
  mediumItalic: '/fonts/GoogleSans-MediumItalic.ttf',
  boldItalic: '/fonts/GoogleSans-BoldItalic.ttf',
} as const

let fontsReady: Promise<void> | null = null

/**
 * Ensure Google Sans is loaded for DOM + canvas text (generated images / twibbon labels).
 */
export async function ensureGoogleSansReady(): Promise<void> {
  if (typeof document === 'undefined') return
  if (!fontsReady) {
    fontsReady = (async () => {
      if (!document.fonts?.load) return
      await Promise.all([
        document.fonts.load(`400 16px "${GOOGLE_SANS_FONT_FAMILY}"`),
        document.fonts.load(`500 16px "${GOOGLE_SANS_FONT_FAMILY}"`),
        document.fonts.load(`700 16px "${GOOGLE_SANS_FONT_FAMILY}"`),
        document.fonts.load(`italic 400 16px "${GOOGLE_SANS_FONT_FAMILY}"`),
      ])
      await document.fonts.ready
    })().catch((err) => {
      fontsReady = null
      throw err
    })
  }
  await fontsReady
}

export function googleSansCanvasFont(sizePx: number, weight: 400 | 500 | 700 = 400): string {
  return `${weight} ${sizePx}px "${GOOGLE_SANS_FONT_FAMILY}", ui-sans-serif, system-ui, sans-serif`
}

/** Default chapter twibbon — rendered with Google Sans chrome, not SVG text. */
export function isBrandTwibbon(url: string | null | undefined): boolean {
  if (!url) return false
  return /gdg-medan\.svg(?:$|\?)/i.test(url) || url.includes('/twibbon/gdg-medan')
}
