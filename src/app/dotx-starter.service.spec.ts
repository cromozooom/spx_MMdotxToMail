import JSZip from 'jszip';
import { DotxStarterService } from './dotx-starter.service';
import { DEFAULT_THEME, DEFAULT_THEME_LIBRARY } from './theme-library';

describe('DotxStarterService', () => {
  it('creates a Word template containing the themed styles', async () => {
    const blob = await new DotxStarterService().createStarterDotx(DEFAULT_THEME);
    const zip = await JSZip.loadAsync(await blob.arrayBuffer());
    const contentTypes = (await zip.file('[Content_Types].xml')?.async('string')) ?? '';
    const styles = (await zip.file('word/styles.xml')?.async('string')) ?? '';

    expect(contentTypes).toContain('wordprocessingml.template.main+xml');
    expect(contentTypes).not.toContain('wordprocessingml.document.main+xml');
    for (const id of ['Heading1', 'Heading7', 'Title', 'Subtitle', 'Quote', 'IntenseQuote', 'Strong', 'BookTitle']) {
      expect(styles.match(new RegExp(`w:styleId="${id}"`, 'g'))?.length).toBe(1);
    }
    expect(styles).toContain('00835F');
    expect(styles).toContain('w:val="49"'); // 32.44px title ≈ 24.5pt

    const quote = /<w:style [^>]*w:styleId="Quote"[\s\S]*?<\/w:style>/.exec(styles)?.[0] ?? '';
    expect(quote).toContain('<w:pBdr>');
    expect(quote).toContain('w:color="CBD5E1"');
    expect(quote).toContain('<w:ind');
  });

  it('exports distinct Quote and Intense Quote styles for every built-in theme', async () => {
    for (const theme of DEFAULT_THEME_LIBRARY) {
      const blob = await new DotxStarterService().createStarterDotx(theme);
      const zip = await JSZip.loadAsync(await blob.arrayBuffer());
      const styles = (await zip.file('word/styles.xml')?.async('string')) ?? '';
      const styleXml = (id: string) => new RegExp(`<w:style [^>]*w:styleId="${id}"[\\s\\S]*?</w:style>`).exec(styles)?.[0] ?? '';
      const quote = styleXml('Quote');
      const intense = styleXml('IntenseQuote');
      const border = (xml: string) => /<w:left [^>]*w:color="([0-9A-F]{6})"/.exec(xml)?.[1];

      expect(quote).toContain('<w:pBdr>');
      expect(intense).toContain('<w:pBdr>');
      expect(border(quote)).toBe(theme.styles.quote.borderLeft?.split(' ').pop()?.slice(1).toUpperCase());
      expect(border(intense)).toBe(theme.styles.intenseQuote.borderLeft?.split(' ').pop()?.slice(1).toUpperCase());
      expect(quote).not.toBe(intense);
    }
  });
});
