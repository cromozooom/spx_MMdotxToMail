import { describe, expect, it } from 'vitest';
import { prettyPrintMarkup } from './pretty-print';

describe('prettyPrintMarkup', () => {
  it('puts each element on its own indented line and keeps inline text together', () => {
    const out = prettyPrintMarkup('<div><p>Hi <strong>you</strong>.</p><ul><li>A</li></ul><br/></div>');

    expect(out).toBe(['<div>', '  <p>Hi <strong>you</strong>.</p>', '  <ul>', '    <li>A</li>', '  </ul>', '  <br/>', '</div>'].join('\n'));
  });

  it('formats style blocks one declaration per line and keeps comments whole', () => {
    const out = prettyPrintMarkup('<head><style>p{color:red;margin:0}</style><!--[if mso]><td><![endif]--></head>');

    expect(out).toBe(
      ['<head>', '  <style>', '    p {', '      color:red;', '      margin:0', '    }', '  </style>', '  <!--[if mso]><td><![endif]-->', '</head>'].join('\n'),
    );
  });
});
