import type { Editor } from '@milkdown/core';

/** Word character styles that plain Markdown cannot express; kept as `<span class="...">` in the Markdown. */
export const STYLED_SPAN_CLASSES = ['subtle', 'book-title', 'subtle-ref', 'intense-ref'] as const;
export type StyledSpanClass = (typeof STYLED_SPAN_CLASSES)[number];

const OPEN_TAG = new RegExp(`^<span class="(${STYLED_SPAN_CLASSES.join('|')})">$`);
const CLOSE_TAG = '</span>';

interface MdNode {
  type: string;
  value?: string;
  cls?: string;
  children?: MdNode[];
}

// Turns inline `<span class="x">`, text, `</span>` sibling nodes into a single `styledSpan` node.
function groupSpans(parent: MdNode): void {
  const children = parent.children;
  if (!children) return;

  const result: MdNode[] = [];
  for (let i = 0; i < children.length; i++) {
    const match = children[i].type === 'html' ? OPEN_TAG.exec(children[i].value ?? '') : null;
    const closeIndex = match ? children.findIndex((n, j) => j > i && n.type === 'html' && n.value === CLOSE_TAG) : -1;
    if (match && closeIndex > i) {
      const span: MdNode = { type: 'styledSpan', cls: match[1], children: children.slice(i + 1, closeIndex) };
      groupSpans(span);
      result.push(span);
      i = closeIndex;
    } else {
      groupSpans(children[i]);
      result.push(children[i]);
    }
  }
  parent.children = result;
}

export async function createStyledSpanPlugins() {
  const [{ $markSchema, $remark }, { toggleMark }, { editorViewCtx }] = await Promise.all([
    import('@milkdown/utils'),
    import('@milkdown/prose/commands'),
    import('@milkdown/core'),
  ]);

  const remarkStyledSpan = $remark('styledSpan', () =>
    function (this: { data: () => any }) {
      const data = this.data();
      const handler = (node: MdNode, _parent: unknown, state: any, info: unknown) =>
        `<span class="${node.cls}">${state.containerPhrasing(node, info)}</span>`;
      data['toMarkdownExtensions'] = [
        ...((data['toMarkdownExtensions'] as unknown[]) ?? []),
        { handlers: { styledSpan: handler } },
      ];
      return (tree: MdNode) => groupSpans(tree);
    },
  );

  const styledSpanMark = $markSchema('styledSpan', () => ({
    attrs: { cls: { default: 'subtle' } },
    parseDOM: STYLED_SPAN_CLASSES.map((cls) => ({ tag: `span.${cls}`, getAttrs: () => ({ cls }) })),
    toDOM: (mark) => ['span', { class: mark.attrs['cls'] }, 0],
    parseMarkdown: {
      match: (node) => node.type === 'styledSpan',
      runner: (state, node, markType) => {
        state.openMark(markType, { cls: (node as MdNode).cls });
        state.next(node.children);
        state.closeMark(markType);
      },
    },
    toMarkdown: {
      match: (mark) => mark.type.name === 'styledSpan',
      runner: (state, mark) => {
        state.withMark(mark, 'styledSpan', undefined, { cls: mark.attrs['cls'] });
      },
    },
  }));

  const toggle = (editor: Editor, cls: StyledSpanClass) =>
    editor.action((ctx) => {
      const view = ctx.get(editorViewCtx);
      toggleMark(styledSpanMark.type(ctx), { cls })(view.state, view.dispatch);
      view.focus();
    });

  return { plugins: [...remarkStyledSpan, styledSpanMark].flat(), toggle };
}
