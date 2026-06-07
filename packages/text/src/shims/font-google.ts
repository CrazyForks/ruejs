import { createFontLoader } from './font-google-base'

export {
  default,
  buildGoogleFontsUrl,
  getSSRFontLinks,
  getSSRFontStyles,
  getSSRFontPreloads,
  createFontLoader,
} from './font-google-base'

export const Geist = /*#__PURE__*/ createFontLoader('Geist')
export const Geist_Mono = /*#__PURE__*/ createFontLoader('Geist Mono')
