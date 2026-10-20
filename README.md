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

1. `mammoth` extracts document HTML from a selected `.docx`.
2. `turndown` converts the HTML to Markdown.
3. Milkdown lets you edit the imported Markdown.
4. Faker replaces `{fullName}`, `{email}`, and `{company}` placeholders with sample values.
5. `mjml-browser` compiles the content into responsive email HTML.
6. The compiled HTML is rendered in a sandboxed preview iframe.

The sample document is available immediately when the app starts. Click **Merge & preview** to generate a new set of sample data and compile the email.

## Notes

- File processing and preview generation happen locally in the browser.
- This is a POC, not a production email-sending tool. Review the generated output in the email clients you intend to support.
- Angular's builder manages its Vite configuration internally; custom Vite plugins in a root `vite.config.ts` are not applied by this workspace.
