# Dotx Mailmerge POC

An Angular proof of concept for turning a `.docx` document into a responsive email preview entirely in the browser.

## Requirements

- Node.js `^20.19.0 || ^22.12.0 || >=24.0.0`
- npm

This workspace uses Angular 21 and Angular's built-in Vite-backed development server and application builder. A standalone `vite.config.ts` is not used by the Angular CLI builder.

## Run locally

```sh
npm install
npm start
```

The workspace enables npm's legacy peer-dependency resolution because npm 10.9 currently fails while resolving Angular's generated test-tool peer graph.

## Conversion flow

1. `mammoth` extracts document HTML from a selected `.docx`, mapping standard Word heading, title, subtitle, quote, paragraph, list, and character styles.
2. `turndown` converts the mapped HTML to Markdown, including subtitles, citations, and reference character styles.
3. Milkdown lets you edit the imported Markdown with a formatting toolbar for paragraphs, titles, headings 1–7, subtitles, quotes, lists, and character styles.
4. A selected JSON theme styles the Milkdown editor and the generated MJML email.
5. Faker replaces `{fullName}`, `{email}`, and `{company}` placeholders with sample values.
6. `mjml-browser` compiles the content into responsive email HTML.
7. The compiled HTML is rendered in a sandboxed preview iframe.

The sample document is available immediately and the email preview updates live as you edit. Click **New sample data** to regenerate the merge values.

## Theme library

Use the **Theme** selector in the header to switch themes. **Download JSON** exports the selected theme; edit the JSON and use **Upload JSON** to add it to the local theme library or replace a theme with the same id. The library and selected theme are saved in this browser's local storage.

Each theme has `colors` for the email/editor backgrounds and a `styles` object for paragraph, title, subtitle, heading levels 1–6, quotes, lists, and inline character styles. Every style accepts `fontFamily`, `fontSize`, `fontWeight`, `letterSpacing`, `lineHeight`, `color`, `backgroundColor`, `fontStyle`, `textDecoration`, `marginTop`, and `marginBottom`. Values are validated when imported; invalid individual style values use that style's defaults. Heading 7 uses the Heading 6 Markdown style. Markdown does not preserve all Word style distinctions: Title and Heading 1 both become H1, Subtitle and inline emphasis both use italics, and subtle/reference styles collapse to italic text.

## Dark-mode preview

The config panel has a Light/Dark switch and an email-client selector (Outlook by default); the preview toolbar offers the same four modes. The choice is saved in localStorage. The preview HTML is transformed before it is set as the iframe `srcdoc`; the real MJML output is unchanged.

- **Gmail (Inverted)**: `filter: invert(0.92) hue-rotate(180deg)` on the iframe container, iframe background `#121212`.
- **Apple Mail (Media Query)**: injects `@media (prefers-color-scheme: dark)` rules and a `.dark` body class. No filters.
- **Outlook (Vendor Overrides)**: adds `data-ogsb`/`data-ogsc` attributes and `[data-ogsb]`/`[data-ogsc]` overrides (`#2d2d2d`, `#1e1e1e`, white text). No filters.

## Layout components

Reusable layout pieces live in `src/app/layout/`:

- `app-shell` – full-height page with `shellHeader`, a resizable `config` | `main` split and a `shellFooter` bar.
- `app-split-pane` – two resizable panes (`paneStart`, `paneEnd`) with minimum widths; drag the handle, use the arrow keys, or double-click to reset.
- `app-panel` – numbered pane with `panelActions`, `panelStatus` and `panelFooter` slots.

## Notes

- File processing and preview generation happen locally in the browser.
- Toolbar formatting edits the Markdown document directly. Word styles without distinct Markdown syntax (such as subtle emphasis and reference styles) use italic emphasis; Heading 7 uses Markdown heading level 6.
- This is a POC, not a production email-sending tool. Review the generated output in the email clients you intend to support.
- Angular's builder manages its Vite configuration internally; custom Vite plugins in a root `vite.config.ts` are not applied by this workspace.
