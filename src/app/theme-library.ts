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
  marginLeft?: string;
  marginRight?: string;
  paddingTop?: string;
  paddingRight?: string;
  paddingBottom?: string;
  paddingLeft?: string;
  /** `none` or `<width>px <solid|dashed|dotted|double> <color>`, e.g. `4px solid #cbd5e1`. */
  borderLeft?: string;
}

export const OPTIONAL_BOX_FIELDS = [
  'marginLeft',
  'marginRight',
  'paddingTop',
  'paddingRight',
  'paddingBottom',
  'paddingLeft',
  'borderLeft',
] as const;

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
  name: 'Default (Major Second)',
  colors: {
    emailBackground: '#f1f5f9',
    contentBackground: '#ffffff',
    editorBackground: '#ffffff',
    editorForeground: '#1e293b',
  },
  styles: {
    ...defaultStyles,
    paragraph: { ...defaultTextStyle },
    title: { ...defaultTextStyle, color: '#00835f', fontSize: '32.44px', fontWeight: '700', lineHeight: '1.2', marginTop: '0px' },
    subtitle: {
      ...defaultTextStyle,
      fontSize: '18px',
      fontStyle: 'italic',
      color: '#64748b',
      marginTop: '0px',
    },
    heading1: { ...defaultTextStyle, color: '#00835f', fontSize: '28.83px', fontWeight: '700', lineHeight: '1.2' },
    heading2: { ...defaultTextStyle, color: '#00835f', fontSize: '25.63px', fontWeight: '700', lineHeight: '1.25' },
    heading3: { ...defaultTextStyle, color: '#00835f', fontSize: '22.78px', fontWeight: '700', lineHeight: '1.3' },
    heading4: { ...defaultTextStyle, color: '#00835f', fontSize: '20.25px', fontWeight: '700', lineHeight: '1.35' },
    heading5: { ...defaultTextStyle, color: '#00835f', fontSize: '18px', fontWeight: '700', lineHeight: '1.4' },
    heading6: { ...defaultTextStyle, color: '#00835f', fontSize: '16px', fontWeight: '700', lineHeight: '1.4' },
    quote: {
      ...defaultTextStyle,
      fontStyle: 'italic',
      color: '#475569',
      backgroundColor: '#f8fafc',
      marginTop: '16px',
      marginBottom: '16px',
      marginLeft: '0px',
      marginRight: '0px',
      paddingTop: '8px',
      paddingRight: '16px',
      paddingBottom: '8px',
      paddingLeft: '16px',
      borderLeft: '4px solid #cbd5e1',
    },
    intenseQuote: {
      ...defaultTextStyle,
      fontStyle: 'italic',
      fontWeight: '600',
      color: '#3730a3',
      backgroundColor: '#eef2ff',
      marginTop: '16px',
      marginBottom: '16px',
      marginLeft: '0px',
      marginRight: '0px',
      paddingTop: '8px',
      paddingRight: '16px',
      paddingBottom: '8px',
      paddingLeft: '16px',
      borderLeft: '4px solid #6366f1',
    },
    list: { ...defaultTextStyle, marginTop: '8px', marginBottom: '8px' },
    strong: { ...defaultTextStyle, fontWeight: '700' },
    emphasis: { ...defaultTextStyle, fontStyle: 'italic' },
    subtleEmphasis: { ...defaultTextStyle, fontStyle: 'italic', color: '#94a3b8' },
    intenseEmphasis: { ...defaultTextStyle, fontWeight: '700', fontStyle: 'italic', color: '#00835f' },
    cite: { ...defaultTextStyle, fontStyle: 'italic', textDecoration: 'underline' },
    subtleReference: { ...defaultTextStyle, color: '#64748b', fontSize: '13px', letterSpacing: '0.08em' },
    intenseReference: {
      ...defaultTextStyle,
      fontWeight: '700',
      color: '#b45309',
      backgroundColor: '#fef3c7',
      letterSpacing: '0.05em',
    },
  },
};

const goldFont = 'Georgia, Times New Roman, serif';
const goldText: ThemeTextStyle = {
  ...defaultTextStyle,
  fontFamily: goldFont,
  fontSize: '17px',
  lineHeight: '1.7',
  color: '#3b2f14',
};
const goldHeading = (size: string, lineHeight: string): ThemeTextStyle => ({
  ...goldText,
  color: '#8a6100',
  fontSize: size,
  fontWeight: '700',
  lineHeight,
  letterSpacing: '0.01em',
});
const goldBox = {
  marginTop: '18px',
  marginBottom: '18px',
  marginLeft: '0px',
  marginRight: '0px',
  paddingTop: '10px',
  paddingRight: '18px',
  paddingBottom: '10px',
  paddingLeft: '18px',
};

// Minor Third scale (x1.2) on a 17px serif base, with a gold and brown palette.
export const GOLD_THEME: DocumentTheme = {
  id: 'gold',
  name: 'Gold (Minor Third)',
  colors: {
    emailBackground: '#f6efd9',
    contentBackground: '#fffdf7',
    editorBackground: '#fffdf7',
    editorForeground: '#3b2f14',
  },
  styles: {
    ...(Object.fromEntries(THEME_STYLE_NAMES.map((name) => [name, { ...goldText }])) as Record<ThemeStyleName, ThemeTextStyle>),
    title: { ...goldHeading('42.3px', '1.15'), color: '#6b4a00', marginTop: '0px' },
    subtitle: { ...goldText, fontSize: '20px', fontStyle: 'italic', color: '#8c7a4d', marginTop: '0px' },
    heading1: goldHeading('35.3px', '1.2'),
    heading2: goldHeading('29.4px', '1.25'),
    heading3: goldHeading('24.5px', '1.3'),
    heading4: goldHeading('20.4px', '1.35'),
    heading5: goldHeading('17px', '1.4'),
    heading6: { ...goldHeading('14.2px', '1.4'), letterSpacing: '0.08em' },
    quote: {
      ...goldText,
      ...goldBox,
      fontStyle: 'italic',
      color: '#5c4a1e',
      backgroundColor: '#fbf3d9',
      borderLeft: '4px solid #d4a72c',
    },
    intenseQuote: {
      ...goldText,
      ...goldBox,
      fontStyle: 'italic',
      fontWeight: '600',
      color: '#fff8dc',
      backgroundColor: '#8a6100',
      borderLeft: '6px solid #f2c94c',
    },
    list: { ...goldText, marginTop: '8px', marginBottom: '8px' },
    strong: { ...goldText, fontWeight: '700' },
    emphasis: { ...goldText, fontStyle: 'italic' },
    subtleEmphasis: { ...goldText, fontStyle: 'italic', color: '#a8966a' },
    intenseEmphasis: { ...goldText, fontWeight: '700', fontStyle: 'italic', color: '#8a6100' },
    cite: { ...goldText, fontStyle: 'italic', textDecoration: 'underline' },
    subtleReference: { ...goldText, color: '#8c7a4d', fontSize: '13.5px', letterSpacing: '0.08em' },
    intenseReference: {
      ...goldText,
      fontWeight: '700',
      color: '#5c3b00',
      backgroundColor: '#f7dc6f',
      letterSpacing: '0.05em',
    },
  },
};

export const DEFAULT_THEME_LIBRARY: DocumentTheme[] = [DEFAULT_THEME, GOLD_THEME];

// Bump when a built-in theme changes so saved copies in local storage are refreshed once.
export const DEFAULT_THEME_REVISION = '5';

const lengthPattern = /^-?\d+(?:\.\d+)?(?:px|pt|em|rem|%)$/;
const borderPattern = /^(?:none|\d+(?:\.\d+)?px (?:solid|dashed|dotted|double) (?:#[\da-fA-F]{3,8}|[a-zA-Z]+))$/;
const safeCssValuePattern = /^[a-zA-Z0-9#.,%() _-]+$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function safeCssValue(value: unknown, field: keyof ThemeTextStyle, fallback: string): string {
  if (typeof value !== 'string' || value.length > 120 || !safeCssValuePattern.test(value)) return fallback;

  if (field === 'borderLeft') return borderPattern.test(value) ? value : fallback;
  if (
    field === 'fontSize' ||
    field === 'marginTop' ||
    field === 'marginBottom' ||
    field === 'marginLeft' ||
    field === 'marginRight' ||
    field === 'paddingTop' ||
    field === 'paddingRight' ||
    field === 'paddingBottom' ||
    field === 'paddingLeft'
  ) {
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
    for (const field of OPTIONAL_BOX_FIELDS) {
      const fallback = defaults[field];
      const next =
        supplied[field] === undefined
          ? fallback
          : safeCssValue(supplied[field], field, fallback ?? (field === 'borderLeft' ? 'none' : '0px'));
      if (next !== undefined) parsed[field] = next;
    }
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
