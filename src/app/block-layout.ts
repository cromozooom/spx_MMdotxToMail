import type { Editor } from '@milkdown/core';
import type { commonmark } from '@milkdown/preset-commonmark';

type MilkdownPlugin = (typeof commonmark)[number];

export type BlockAlign = 'left' | 'center' | 'right' | 'justify';

export const INDENT_STEP_PX = 10;
export const MARGIN_STEP_PX = 10;
export type MarginSide = 'top' | 'bottom';
const MAX_INDENT_PX = 400;
const MAX_MARGIN_PX = 200;
const ALIGNED_BLOCKS = ['paragraph', 'heading'];
// Marks that survive "clear styles": links and inline code are content, not styling.
const KEPT_MARKS = ['link', 'code_inline'];

interface DomSpec extends Array<unknown> {
  0: string;
}

function layoutStyle(attrs: Record<string, unknown>): string {
  const parts: string[] = [];
  if (attrs['align']) parts.push(`text-align:${attrs['align']}`);
  if (Number(attrs['indent']) > 0) parts.push(`margin-left:${attrs['indent']}px`);
  if (attrs['lineHeight']) parts.push(`line-height:${attrs['lineHeight']}`);
  if (attrs['marginTop'] != null) parts.push(`margin-top:${attrs['marginTop']}px`);
  if (attrs['marginBottom'] != null) parts.push(`margin-bottom:${attrs['marginBottom']}px`);
  return parts.join(';');
}

function readLayout(dom: HTMLElement): { align: string | null; indent: number; lineHeight: number | null; marginTop: number | null; marginBottom: number | null } {
  const px = (value: string): number | null => {
    const n = parseFloat(value);
    return value.endsWith('px') && Number.isFinite(n) && n >= 0 ? n : null;
  };
  const lineHeight = parseFloat(dom.style.lineHeight);
  const align = dom.style.textAlign;
  const indent = parseInt(dom.style.marginLeft, 10);
  return {
    align: ['left', 'center', 'right', 'justify'].includes(align) ? align : null,
    indent: Number.isFinite(indent) && indent > 0 ? indent : 0,
    lineHeight: Number.isFinite(lineHeight) && lineHeight > 0 ? lineHeight : null,
    marginTop: px(dom.style.marginTop),
    marginBottom: px(dom.style.marginBottom),
  };
}

/**
 * Adds `align`, `indent` and `lineHeight` attributes to paragraphs and headings.
 * They are rendered as inline styles, so they reach the editor and the email HTML,
 * but plain Markdown cannot express them.
 */
export async function createBlockLayoutPlugins() {
  const [{ paragraphSchema, headingSchema, blockquoteSchema, commonmark }, { editorViewCtx }] = await Promise.all([
    import('@milkdown/preset-commonmark'),
    import('@milkdown/core'),
  ]);

  const extend = (schema: typeof paragraphSchema | typeof headingSchema) =>
    (schema as typeof paragraphSchema).extendSchema((prev) => (ctx) => {
      const base = prev(ctx);
      return {
        ...base,
        attrs: { ...base.attrs, align: { default: null }, indent: { default: 0 }, lineHeight: { default: null }, marginTop: { default: null }, marginBottom: { default: null } },
        parseDOM: base.parseDOM?.map((rule) => ({
          ...rule,
          getAttrs: (dom: HTMLElement | string) => {
            const baseAttrs = (rule as { getAttrs?: (d: HTMLElement | string) => object | false | null }).getAttrs?.(dom);
            if (baseAttrs === false) return false;
            return { ...(baseAttrs ?? {}), ...(typeof dom === 'string' ? {} : readLayout(dom)) };
          },
        })),
        toDOM: (node) => {
          const spec = base.toDOM!(node) as unknown as DomSpec;
          const style = layoutStyle(node.attrs);
          if (!style) return spec as never;
          const [tag, second, ...rest] = spec;
          if (second && typeof second === 'object' && !Array.isArray(second)) {
            const existing = (second as Record<string, string>)['style'];
            return [tag, { ...second, style: existing ? `${existing};${style}` : style }, ...rest] as never;
          }
          return [tag, { style }, second, ...rest] as never;
        },
      };
    });

  const paragraph = extend(paragraphSchema);
  const heading = extend(headingSchema);

  // Intense quotes are a real attribute on the quote node, rendered as class="intense" (themed like the gallery tile).
  const blockquote = blockquoteSchema.extendSchema((prev) => (ctx) => {
    const base = prev(ctx);
    return {
      ...base,
      attrs: { ...base.attrs, intense: { default: false } },
      parseDOM: base.parseDOM?.map((rule) => ({
        ...rule,
        getAttrs: (dom: HTMLElement | string) => ({ intense: typeof dom !== 'string' && dom.classList.contains('intense') }),
      })),
      toDOM: (node) => (node.attrs['intense'] ? ['blockquote', { class: 'intense' }, 0] : ['blockquote', 0]) as never,
    };
  });

  // Swap each stock schema for the extended one at the same position: node order in the schema decides
  // the default block type (e.g. what Enter creates), so paragraph must stay ahead of heading and code.
  const swaps = new Map<unknown, unknown[]>();
  for (const [stock, extended] of [
    [paragraphSchema, paragraph],
    [headingSchema, heading],
    [blockquoteSchema, blockquote],
  ] as [unknown[], unknown[]][]) {
    stock.forEach((plugin, index) => swaps.set(plugin, index === 0 ? extended : []));
  }
  const plugins = (commonmark as MilkdownPlugin[]).flatMap(
    (plugin) => (swaps.has(plugin) ? swaps.get(plugin)! : [plugin]) as MilkdownPlugin[],
  );

  const updateBlocks = (
    editor: Editor,
    update: (attrs: Record<string, unknown>, dom: HTMLElement | null) => Record<string, unknown>,
  ) =>
    editor.action((ctx) => {
      const view = ctx.get(editorViewCtx);
      const { from, to } = view.state.selection;
      const tr = view.state.tr;
      view.state.doc.nodesBetween(from, to, (node, pos) => {
        if (ALIGNED_BLOCKS.includes(node.type.name)) {
          tr.setNodeMarkup(pos, undefined, update({ ...node.attrs }, view.nodeDOM(pos) as HTMLElement | null));
        }
      });
      if (tr.docChanged) view.dispatch(tr);
      view.focus();
    });

  return {
    plugins,

    setAlign: (editor: Editor, align: BlockAlign) =>
      updateBlocks(editor, (attrs) => ({ ...attrs, align: align === 'left' ? null : align })),

    setLineHeight: (editor: Editor, lineHeight: number | null) =>
      updateBlocks(editor, (attrs) => ({ ...attrs, lineHeight })),

    /** Steps the top or bottom margin by 10px, starting from the margin the theme currently gives the block. */
    changeMargin: (editor: Editor, side: MarginSide, direction: 1 | -1) =>
      updateBlocks(editor, (attrs, dom) => {
        const key = side === 'top' ? 'marginTop' : 'marginBottom';
        const themed = dom ? parseFloat(getComputedStyle(dom)[side === 'top' ? 'marginTop' : 'marginBottom']) : 0;
        const current = attrs[key] != null ? Number(attrs[key]) : Number.isFinite(themed) ? themed : 0;
        return { ...attrs, [key]: Math.min(MAX_MARGIN_PX, Math.max(0, Math.round(current) + direction * MARGIN_STEP_PX)) };
      }),

    changeIndent: (editor: Editor, direction: 1 | -1) =>
      updateBlocks(editor, (attrs) => ({
        ...attrs,
        indent: Math.min(MAX_INDENT_PX, Math.max(0, Number(attrs['indent'] ?? 0) + direction * INDENT_STEP_PX)),
      })),

    /** Turns the selected blocks into plain paragraphs and strips alignment, indent and inline styling. */
    clearBlockStyles: (editor: Editor) =>
      editor.action((ctx) => {
        const view = ctx.get(editorViewCtx);
        const { schema, selection, doc } = view.state;
        const tr = view.state.tr;
        const paragraphType = schema.nodes['paragraph'];
        const strippable = Object.values(schema.marks).filter((mark) => !KEPT_MARKS.includes(mark.name));
        doc.nodesBetween(selection.from, selection.to, (node, pos) => {
          if (!node.isTextblock) return;
          tr.setNodeMarkup(pos, paragraphType, { align: null, indent: 0, lineHeight: null, marginTop: null, marginBottom: null });
          strippable.forEach((mark) => tr.removeMark(pos + 1, pos + node.nodeSize - 1, mark));
        });
        if (tr.docChanged) view.dispatch(tr);
        view.focus();
      }),
  };
}
