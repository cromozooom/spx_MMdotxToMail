import { Injectable } from '@angular/core';
import { DocumentTheme, ThemeStyleName, ThemeTextStyle } from './theme-library';

const DOTX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.template';
const DOCX_MAIN_CONTENT_TYPE = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml';
const DOTX_MAIN_CONTENT_TYPE = 'application/vnd.openxmlformats-officedocument.wordprocessingml.template.main+xml';

const PX_TO_HALF_POINTS = 1.5;
const PX_TO_TWIPS = 15;
const PX_TO_POINTS = 0.75;
const MAX_BORDER_SPACE_POINTS = 31;

function parseBorderLeft(value: string | undefined): { widthPx: number; style: string; color: string } | undefined {
  const match = /^(\d+(?:\.\d+)?)px (solid|dashed|dotted|double) (#[\da-fA-F]{6}|[a-zA-Z]+)$/.exec(value?.trim() ?? '');
  if (!match) return undefined;
  const color = hexColor(match[3]);
  return { widthPx: Number(match[1]), style: match[2], color: color ?? '000000' };
}

interface ParagraphStyleSpec {
  id: string;
  name: string;
  source: ThemeStyleName;
  basedOn?: string;
  next?: string;
  italic?: boolean;
  indentLeft?: number;
}

const PARAGRAPH_STYLES: ParagraphStyleSpec[] = [
  { id: 'Heading1', name: 'heading 1', source: 'heading1', basedOn: 'Normal', next: 'Normal' },
  { id: 'Heading2', name: 'heading 2', source: 'heading2', basedOn: 'Normal', next: 'Normal' },
  { id: 'Heading3', name: 'heading 3', source: 'heading3', basedOn: 'Normal', next: 'Normal' },
  { id: 'Heading4', name: 'heading 4', source: 'heading4', basedOn: 'Normal', next: 'Normal' },
  { id: 'Heading5', name: 'heading 5', source: 'heading5', basedOn: 'Normal', next: 'Normal' },
  { id: 'Heading6', name: 'heading 6', source: 'heading6', basedOn: 'Normal', next: 'Normal' },
  { id: 'Heading7', name: 'heading 7', source: 'heading6', basedOn: 'Normal', next: 'Normal', italic: true },
  { id: 'Title', name: 'Title', source: 'title', basedOn: 'Normal', next: 'Normal' },
  { id: 'Subtitle', name: 'Subtitle', source: 'subtitle', basedOn: 'Normal', next: 'Normal' },
  { id: 'Quote', name: 'Quote', source: 'quote', basedOn: 'Normal', next: 'Normal' },
  { id: 'IntenseQuote', name: 'Intense Quote', source: 'intenseQuote', basedOn: 'Normal', next: 'Normal' },
  { id: 'ListParagraph', name: 'List Paragraph', source: 'list', basedOn: 'Normal', indentLeft: 720 },
];

const CHARACTER_STYLES: { id: string; name: string; source: ThemeStyleName }[] = [
  { id: 'Strong', name: 'Strong', source: 'strong' },
  { id: 'Emphasis', name: 'Emphasis', source: 'emphasis' },
  { id: 'SubtleEmphasis', name: 'Subtle Emphasis', source: 'subtleEmphasis' },
  { id: 'IntenseEmphasis', name: 'Intense Emphasis', source: 'intenseEmphasis' },
  { id: 'BookTitle', name: 'Book Title', source: 'cite' },
  { id: 'SubtleReference', name: 'Subtle Reference', source: 'subtleReference' },
  { id: 'IntenseReference', name: 'Intense Reference', source: 'intenseReference' },
];

function pxValue(value: string): number | undefined {
  const match = /^(-?\d+(?:\.\d+)?)px$/.exec(value.trim());
  return match ? Number(match[1]) : undefined;
}

function hexColor(value: string): string | undefined {
  const match = /^#([0-9a-f]{6})$/i.exec(value.trim());
  return match ? match[1].toUpperCase() : undefined;
}

function firstFont(fontFamily: string): string {
  const first = fontFamily.split(',')[0]?.trim().replace(/^['"]|['"]$/g, '');
  return first || 'Arial';
}

function letterSpacingTwips(style: ThemeTextStyle): number | undefined {
  const value = style.letterSpacing.trim();
  const px = pxValue(value);
  if (px !== undefined) return Math.round(px * PX_TO_TWIPS);
  const em = /^(-?\d+(?:\.\d+)?)em$/.exec(value);
  const fontPx = pxValue(style.fontSize);
  if (em && fontPx !== undefined) return Math.round(Number(em[1]) * fontPx * PX_TO_TWIPS);
  return undefined;
}

@Injectable({ providedIn: 'root' })
export class DotxStarterService {
  async downloadStarterDotx(theme: DocumentTheme): Promise<void> {
    const blob = await this.createStarterDotx(theme);
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${theme.id}.starter.dotx`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  async createStarterDotx(theme: DocumentTheme): Promise<Blob> {
    const [docx, { default: JSZip }] = await Promise.all([import('docx'), import('jszip')]);
    const { Document, Packer, Paragraph, TextRun, ShadingType, BorderStyle } = docx;

    const borderStyles: Record<string, (typeof BorderStyle)[keyof typeof BorderStyle]> = {
      solid: BorderStyle.SINGLE,
      dashed: BorderStyle.DASHED,
      dotted: BorderStyle.DOTTED,
      double: BorderStyle.DOUBLE,
    };

    const runOf = (style: ThemeTextStyle, overrides: { italics?: boolean } = {}) => {
      const sizePx = pxValue(style.fontSize);
      const spacing = letterSpacingTwips(style);
      const weight = Number(style.fontWeight);
      return {
        font: firstFont(style.fontFamily),
        ...(sizePx !== undefined ? { size: Math.round(sizePx * PX_TO_HALF_POINTS) } : {}),
        bold: style.fontWeight === 'bold' || weight >= 600,
        italics: overrides.italics ?? style.fontStyle === 'italic',
        color: hexColor(style.color),
        ...(spacing !== undefined ? { characterSpacing: spacing } : {}),
        ...(style.textDecoration === 'underline' ? { underline: {} } : {}),
        ...(style.textDecoration === 'line-through' ? { strike: true } : {}),
      };
    };

    const paragraphOf = (style: ThemeTextStyle, spec?: ParagraphStyleSpec) => {
      const before = pxValue(style.marginTop);
      const after = pxValue(style.marginBottom);
      const lineHeight = Number(style.lineHeight);
      const fill = hexColor(style.backgroundColor);
      const px = (value: string | undefined) => (value === undefined ? 0 : (pxValue(value) ?? 0));
      const border = parseBorderLeft(style.borderLeft);
      const borderWidth = border?.widthPx ?? 0;
      // CSS margin + padding + border widths add up to the Word indent; the border itself sits in the padding.
      const hasBox = style.marginLeft !== undefined || style.paddingLeft !== undefined || border !== undefined;
      const left = hasBox
        ? Math.round((px(style.marginLeft) + px(style.paddingLeft) + borderWidth) * PX_TO_TWIPS)
        : spec?.indentLeft;
      const right = Math.round((px(style.marginRight) + px(style.paddingRight)) * PX_TO_TWIPS);
      return {
        spacing: {
          ...(before !== undefined ? { before: Math.round(before * PX_TO_TWIPS) } : {}),
          ...(after !== undefined ? { after: Math.round(after * PX_TO_TWIPS) } : {}),
          ...(Number.isFinite(lineHeight) && lineHeight > 0 ? { line: Math.round(lineHeight * 240) } : {}),
        },
        ...(left || right ? { indent: { left: left ?? 0, right } } : {}),
        ...(border
          ? {
              border: {
                left: {
                  style: borderStyles[border.style],
                  size: Math.max(2, Math.min(48, Math.round(border.widthPx * PX_TO_POINTS * 8))),
                  color: border.color,
                  space: Math.min(MAX_BORDER_SPACE_POINTS, Math.round(px(style.paddingLeft) * PX_TO_POINTS)),
                },
              },
            }
          : {}),
        ...(fill ? { shading: { type: ShadingType.CLEAR, color: 'auto', fill } } : {}),
      };
    };

    const doc = new Document({
      title: `${theme.name} starter template`,
      styles: {
        default: {
          document: {
            run: runOf(theme.styles.paragraph),
            paragraph: paragraphOf(theme.styles.paragraph),
          },
        },
        paragraphStyles: PARAGRAPH_STYLES.map((spec) => ({
          id: spec.id,
          name: spec.name,
          basedOn: spec.basedOn,
          next: spec.next,
          quickFormat: true,
          run: runOf(theme.styles[spec.source], { italics: spec.italic }),
          paragraph: paragraphOf(theme.styles[spec.source], spec),
        })),
        characterStyles: CHARACTER_STYLES.map((spec) => ({
          id: spec.id,
          name: spec.name,
          basedOn: 'DefaultParagraphFont',
          quickFormat: true,
          run: runOf(theme.styles[spec.source]),
        })),
      },
      sections: [
        {
          children: [
            new Paragraph({ text: 'Document title', style: 'Title' }),
            new Paragraph({ text: 'Document subtitle', style: 'Subtitle' }),
            ...[1, 2, 3, 4, 5, 6, 7].map(
              (level) => new Paragraph({ text: `Heading ${level}`, style: `Heading${level}` }),
            ),
            new Paragraph({
              children: [
                new TextRun({ text: 'Normal text with ' }),
                ...CHARACTER_STYLES.flatMap(({ id, name }) => [
                  new TextRun({ text: name, style: id }),
                  new TextRun({ text: ', ' }),
                ]),
                new TextRun({ text: 'and more.' }),
              ],
            }),
            new Paragraph({ text: 'Quote', style: 'Quote' }),
            new Paragraph({ text: 'Intense quote', style: 'IntenseQuote' }),
            new Paragraph({ text: 'List paragraph', style: 'ListParagraph' }),
          ],
        },
      ],
    });

    // docx only emits .docx packages; switching the main part content type turns it into a template.
    const zip = await JSZip.loadAsync(await (await Packer.toBlob(doc)).arrayBuffer());
    const contentTypes = await zip.file('[Content_Types].xml')?.async('string');
    if (!contentTypes?.includes(DOCX_MAIN_CONTENT_TYPE)) {
      throw new Error('The generated Word package has an unexpected structure.');
    }
    zip.file('[Content_Types].xml', contentTypes.replace(DOCX_MAIN_CONTENT_TYPE, DOTX_MAIN_CONTENT_TYPE));
    return zip.generateAsync({ type: 'blob', mimeType: DOTX_MIME });
  }
}
