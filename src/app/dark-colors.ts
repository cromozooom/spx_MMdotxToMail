import Color from 'colorjs.io';

export const DARK_BACKGROUND = '#18181b';
export const MIN_CONTRAST = 4.5;

const LIGHTNESS_STEP = 0.01;
const MAX_LIGHTNESS = 0.98;

/**
 * Lightens a light-mode text colour in OKLCH (keeping hue and chroma) until it reaches the WCAG 2.1
 * contrast ratio against the dark background. Colours that already pass are returned unchanged.
 * Returns undefined when the value is not a parseable CSS colour.
 */
export function ensureAccessibleDarkColor(
  textColor: string,
  darkBackground: string = DARK_BACKGROUND,
  minContrast: number = MIN_CONTRAST,
): string | undefined {
  let background: Color;
  let text: Color;
  try {
    background = new Color(darkBackground);
    text = new Color(textColor);
  } catch {
    return undefined;
  }

  const toHex = (color: Color): string => color.to('srgb').toGamut().toString({ format: 'hex', collapse: false });
  if (text.contrast(background, 'WCAG21') >= minContrast) return toHex(text);

  const lightened = text.to('oklch');
  while (lightened.contrast(background, 'WCAG21') < minContrast && (lightened.coords[0] ?? 1) < MAX_LIGHTNESS) {
    lightened.coords[0] = (lightened.coords[0] ?? 0) + LIGHTNESS_STEP;
  }
  return toHex(lightened);
}
