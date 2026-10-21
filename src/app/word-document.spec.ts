import { describe, expect, it } from 'vitest';
import { convertWordHtmlToMarkdown } from './word-document';

describe('convertWordHtmlToMarkdown', () => {
  it('keeps subtle/intense character styles as classed spans', () => {
    const markdown = convertWordHtmlToMarkdown(
      '<p><em class="subtle">a</em> <cite>b</cite> <span class="subtle-ref">c</span> <span class="intense-ref">d</span></p>',
    );

    expect(markdown).toBe(
      '<span class="subtle">a</span> <span class="book-title">b</span> <span class="subtle-ref">c</span> <span class="intense-ref">d</span>',
    );
  });

  it('still converts plain emphasis to Markdown', () => {
    expect(convertWordHtmlToMarkdown('<p><em>x</em></p>')).toBe('*x*');
  });
});
