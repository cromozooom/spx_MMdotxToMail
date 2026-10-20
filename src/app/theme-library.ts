export const THEME_STYLE_NAMES = [
  'paragraph',
  'title',
  'subtitle',
  'heading1',
  'heading2',
  'heading3',
  'heading4',
  'heading5',
  'heading6',
  'quote',
  'intenseQuote',
  'list',
  'strong',
  'emphasis',
  'subtleEmphasis',
  'intenseEmphasis',
  'cite',
  'subtleReference',
  'intenseReference',
] as const;

export type ThemeStyleName = (typeof THEME_STYLE_NAMES)[number];

export interface ThemeTextStyle {
  fontFamily: string;
  fontSize: string;
  fontWeight: string;
  letterSpacing: string;
  lineHeight: string;
  color: string;
  backgroundColor: string;
  fontStyle: 'normal' | 'italic';
  textDecoration: 'none' | 'underline' | 'line-through';
  marginTop: string;
  marginBottom: string;
}

export interface ThemeColors {
  emailBackground: string;
  contentBackground: string;
  editorBackground: string;
  editorForeground: string;
}

export interface DocumentTheme {
  id: string;
  name: string;
  colors: ThemeColors;
  styles: Record<ThemeStyleName, ThemeTextStyle>;
}

const defaultTextStyle: ThemeTextStyle = {
  fontFamily: 'Arial, sans-serif',
  fontSize: '16px',
  fontWeight: '400',
  letterSpacing: 'normal',
  lineHeight: '1.6',
  color: '#1e293b',
  backgroundColor: 'transparent',
  fontStyle: 'normal',
  textDecoration: 'none',
  marginTop: '12px',
  marginBottom: '12px',
};

const defaultStyles = Object.fromEntries(
  THEME_STYLE_NAMES.map((name) => [name, { ...defaultTextStyle }]),
) as Record<ThemeStyleName, ThemeTextStyle>;

export const DEFAULT_THEME: DocumentTheme = {
  id: 'default',
  name: 'Default',
  colors: {
    emailBackground: '#f1f5f9',
    contentBackground: '#ffffff',
    editorBackground: '#ffffff',
    editorForeground: '#1e293b',
  },
  styles: {
    ...defaultStyles,
    paragraph: { ...defaultTextStyle },
    title: { ...defaultTextStyle, fontSize: '32px', fontWeight: '700', lineHeight: '1.2', marginTop: '0px' },
    subtitle: {
      ...defaultTextStyle,
      fontSize: '18px',
      fontStyle: 'italic',
      color: '#64748b',
      marginTop: '0px',
    },
    heading1: { ...defaultTextStyle, fontSize: '32px', fontWeight: '700', lineHeight: '1.2' },
    heading2: { ...defaultTextStyle, fontSize: '26px', fontWeight: '700', lineHeight: '1.25' },
    heading3: { ...defaultTextStyle, fontSize: '22px', fontWeight: '700', lineHeight: '1.3' },
    heading4: { ...defaultTextStyle, fontSize: '20px', fontWeight: '700', lineHeight: '1.35' },
    heading5: { ...defaultTextStyle, fontSize: '18px', fontWeight: '700', lineHeight: '1.4' },
    heading6: { ...defaultTextStyle, fontSize: '16px', fontWeight: '700', lineHeight: '1.4' },
    quote: {
      ...defaultTextStyle,
      fontStyle: 'italic',
      color: '#475569',
      backgroundColor: '#f8fafc',
      marginTop: '16px',
      marginBottom: '16px',
    },
    intenseQuote: {
      ...defaultTextStyle,
      fontStyle: 'italic',
      fontWeight: '600',
      color: '#3730a3',
      backgroundColor: '#eef2ff',
      marginTop: '16px',
      marginBottom: '16px',
    },
    list: { ...defaultTextStyle, marginTop: '8px', marginBottom: '8px' },
    strong: { ...defaultTextStyle, fontWeight: '700' },
    emphasis: { ...defaultTextStyle, fontStyle: 'italic' },
    subtleEmphasis: { ...defaultTextStyle, fontStyle: 'italic', color: '#64748b' },
    intenseEmphasis: { ...defaultTextStyle, fontWeight: '700', fontStyle: 'italic' },
    cite: { ...defaultTextStyle, fontStyle: 'italic' },
    subtleReference: { ...defaultTextStyle, fontStyle: 'italic', color: '#64748b' },
    intenseReference: { ...defaultTextStyle, fontWeight: '600', fontStyle: 'italic' },
  },
};

export const DEFAULT_THEME_LIBRARY: DocumentTheme[] = [DEFAULT_THEME];

const lengthPattern = /^-?\d+(?:\.\d+)?(?:px|pt|em|rem|%)$/;
const safeCssValuePattern = /^[a-zA-Z0-9#.,%() _-]+$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function safeCssValue(value: unknown, field: keyof ThemeTextStyle, fallback: string): string {
  if (typeof value !== 'string' || value.length > 120 || !safeCssValuePattern.test(value)) return fallback;

  if (field === 'fontSize' || field === 'marginTop' || field === 'marginBottom') {
    return lengthPattern.test(value) ? value : fallback;
  }
  if (field === 'fontWeight') {
    return /^(?:[1-9]00|normal|bold|bolder|lighter)$/.test(value) ? value : fallback;
  }
  if (field === 'letterSpacing') {
    return value === 'normal' || /^-?\d+(?:\.\d+)?(?:px|em)$/.test(value) ? value : fallback;
  }
  if (field === 'lineHeight') {
    return value === 'normal' || /^\d+(?:\.\d+)?$/.test(value) || lengthPattern.test(value)
      ? value
      : fallback;
  }
  if (field === 'color' || field === 'backgroundColor') {
    return /^(?:#[\da-fA-F]{3,8}|[a-zA-Z]+|rgba?\([\d\s.,%]+\))$/.test(value) ? value : fallback;
  }
  if (field === 'fontStyle') {
    return value === 'italic' || value === 'normal' ? value : fallback;
  }
  if (field === 'textDecoration') {
    return value === 'none' || value === 'underline' || value === 'line-through' ? value : fallback;
  }

  return value.trim() ? value : fallback;
}

function safeColor(value: unknown, fallback: string): string {
  if (typeof value !== 'string') return fallback;
  return /^(?:#[\da-fA-F]{3,8}|[a-zA-Z]+|rgba?\([\d\s.,%]+\))$/.test(value) ? value : fallback;
}

export function parseDocumentTheme(value: unknown): DocumentTheme {
  if (!isRecord(value)) throw new Error('Theme JSON must be an object.');

  const id = typeof value['id'] === 'string' ? value['id'].trim() : '';
  const name = typeof value['name'] === 'string' ? value['name'].trim() : '';
  if (!/^[a-z0-9][a-z0-9-]{0,49}$/.test(id)) {
    throw new Error('Theme id must use lowercase letters, numbers, and hyphens.');
  }
  if (!name || name.length > 60) throw new Error('Theme name must be between 1 and 60 characters.');

  const inputColors = isRecord(value['colors']) ? value['colors'] : {};
  const inputStyles = isRecord(value['styles']) ? value['styles'] : {};
  const colors: ThemeColors = {
    emailBackground: safeColor(inputColors['emailBackground'], DEFAULT_THEME.colors.emailBackground),
    contentBackground: safeColor(inputColors['contentBackground'], DEFAULT_THEME.colors.contentBackground),
    editorBackground: safeColor(inputColors['editorBackground'], DEFAULT_THEME.colors.editorBackground),
    editorForeground: safeColor(inputColors['editorForeground'], DEFAULT_THEME.colors.editorForeground),
  };
  const styles = {} as Record<ThemeStyleName, ThemeTextStyle>;

  for (const styleName of THEME_STYLE_NAMES) {
    const supplied = isRecord(inputStyles[styleName]) ? inputStyles[styleName] : {};
    const defaults = DEFAULT_THEME.styles[styleName];
    const parsed: ThemeTextStyle = {
      fontFamily: safeCssValue(supplied['fontFamily'], 'fontFamily', defaults.fontFamily),
      fontSize: safeCssValue(supplied['fontSize'], 'fontSize', defaults.fontSize),
      fontWeight: safeCssValue(supplied['fontWeight'], 'fontWeight', defaults.fontWeight),
      letterSpacing: safeCssValue(supplied['letterSpacing'], 'letterSpacing', defaults.letterSpacing),
      lineHeight: safeCssValue(supplied['lineHeight'], 'lineHeight', defaults.lineHeight),
      color: safeCssValue(supplied['color'], 'color', defaults.color),
      backgroundColor: safeCssValue(supplied['backgroundColor'], 'backgroundColor', defaults.backgroundColor),
      fontStyle: supplied['fontStyle'] === 'italic' ? 'italic' : supplied['fontStyle'] === 'normal' ? 'normal' : defaults.fontStyle,
      textDecoration:
        supplied['textDecoration'] === 'underline' || supplied['textDecoration'] === 'line-through'
          ? supplied['textDecoration']
          : supplied['textDecoration'] === 'none'
            ? 'none'
            : defaults.textDecoration,
      marginTop: safeCssValue(supplied['marginTop'], 'marginTop', defaults.marginTop),
      marginBottom: safeCssValue(supplied['marginBottom'], 'marginBottom', defaults.marginBottom),
    };
    styles[styleName] = parsed;
  }

  return { id, name, colors, styles };
}

export function parseThemeLibrary(value: unknown): { themes: DocumentTheme[]; selectedThemeId: string } {
  if (!isRecord(value) || value['version'] !== 1 || !Array.isArray(value['themes'])) {
    throw new Error('Saved theme library has an unsupported format.');
  }
  const themes = value['themes'].map(parseDocumentTheme);
  if (themes.length === 0 || themes.length > 50) {
    throw new Error('Theme library must contain between 1 and 50 themes.');
  }
  const ids = themes.map(({ id }) => id);
  if (new Set(ids).size !== ids.length) throw new Error('Theme ids in the library must be unique.');
  const selectedThemeId = typeof value['selectedThemeId'] === 'string' ? value['selectedThemeId'] : '';
  if (!ids.includes(selectedThemeId)) throw new Error('Selected theme is missing from the library.');
  return { themes, selectedThemeId };
}

export function themeLibraryJson(themes: DocumentTheme[], selectedThemeId: string): string {
  return JSON.stringify({ version: 1, selectedThemeId, themes }, null, 2);
}
