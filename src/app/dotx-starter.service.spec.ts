import JSZip from 'jszip';
import { DotxStarterService } from './dotx-starter.service';
import { DEFAULT_THEME } from './theme-library';

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
});
