import type { Editor } from '@milkdown/core';
import type { commonmark } from '@milkdown/preset-commonmark';

type MilkdownPlugin = (typeof commonmark)[number];

export type BlockAlign = 'left' | 'center' | 'right' | 'justify';

export const INDENT_STEP_PX = 10;
const MAX_INDENT_PX = 400;
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
  return parts.join(';');
}

function readLayout(dom: HTMLElement): { align: string | null; indent: number } {
  const align = dom.style.textAlign;
  const indent = parseInt(dom.style.marginLeft, 10);
  return {
    align: ['left', 'center', 'right', 'justify'].includes(align) ? align : null,
    indent: Number.isFinite(indent) && indent > 0 ? indent : 0,
  };
}

/**
 * Adds `align` and `indent` attributes to paragraphs and headings.
 * They are rendered as inline styles, so they reach the editor and the email HTML,
 * but plain Markdown cannot express them.
 */
export async function createBlockLayoutPlugins() {
  const [{ paragraphSchema, headingSchema, commonmark }, { editorViewCtx }] = await Promise.all([
    import('@milkdown/preset-commonmark'),
    import('@milkdown/core'),
  ]);

  const extend = (schema: typeof paragraphSchema | typeof headingSchema) =>
    (schema as typeof paragraphSchema).extendSchema((prev) => (ctx) => {
      const base = prev(ctx);
      return {
        ...base,
        attrs: { ...base.attrs, align: { default: null }, indent: { default: 0 } },
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

  // Replace the stock plugins with the extended ones: same ids, so the editor swaps the schemas.
  const replaced = new Set<unknown>([...(paragraphSchema as unknown[]), ...(headingSchema as unknown[])]);
  const preset: MilkdownPlugin[] = (commonmark as MilkdownPlugin[]).filter((plugin) => !replaced.has(plugin));
  const plugins: MilkdownPlugin[] = [...preset, ...(paragraph as unknown as MilkdownPlugin[]), ...(heading as unknown as MilkdownPlugin[])];

  const updateBlocks = (editor: Editor, update: (attrs: Record<string, unknown>) => Record<string, unknown>) =>
    editor.action((ctx) => {
      const view = ctx.get(editorViewCtx);
      const { from, to } = view.state.selection;
      const tr = view.state.tr;
      view.state.doc.nodesBetween(from, to, (node, pos) => {
        if (ALIGNED_BLOCKS.includes(node.type.name)) {
          tr.setNodeMarkup(pos, undefined, update({ ...node.attrs }));
        }
      });
      if (tr.docChanged) view.dispatch(tr);
      view.focus();
    });

  return {
    plugins,

    setAlign: (editor: Editor, align: BlockAlign) =>
      updateBlocks(editor, (attrs) => ({ ...attrs, align: align === 'left' ? null : align })),

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
          tr.setNodeMarkup(pos, paragraphType, { align: null, indent: 0 });
          strippable.forEach((mark) => tr.removeMark(pos + 1, pos + node.nodeSize - 1, mark));
        });
        if (tr.docChanged) view.dispatch(tr);
        view.focus();
      }),
  };
}
