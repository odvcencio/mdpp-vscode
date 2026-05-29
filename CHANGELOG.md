# Changelog

## [0.2.0] - 2026-05-29

### Changed

- Bundle and default to the **mdpp v0.4.0** language server. mdpp now parses with the
  grammargen-generated grammar (owned end-to-end) instead of the bundled tree-sitter blob.
  This brings the whole v0.2→v0.4 parser line into the editor: recursion-safe parsing,
  correct pipe-table body rows, list/blockquote wrappers in every context, consecutive
  link-reference-definitions, nested blockquotes, multiple admonitions per document,
  raw-HTML escaping in headings, loose-list continuations, and fuller semantic-token
  coverage — all delivered transparently over LSP, no extension API changes required.
- `markdownpp.binary.version` now defaults to `v0.4.0`; the managed-download path targets
  the auto-published `v0.4.0` GitHub release assets (darwin/linux amd64+arm64, windows amd64).

## [0.1.10] - 2026-04-20

### Added

- Marketplace-ready extension metadata, icon, screenshots, README, and license.
- Managed `mdpp-lsp` download with `checksums.txt` SHA-256 verification.
- Live preview command in the editor title bar for Markdown files.
- Restart language server command.
- Opt-in format-on-save setting backed by the mdpp formatter.
- Fallback TextMate grammar for Markdown++ directives, containers, footnotes, math, and emoji shortcodes.

### Changed

- The extension now defaults to the `v0.1.10` mdpp binary release.

## [0.1.1] - 2026-04-20

### Added

- Initial marketplace metadata, icon, screenshots, README, and license.
- Managed `mdpp-lsp` download with `checksums.txt` SHA-256 verification.

## [0.1.0] - 2026-04-20

### Added

- Initial VS Code extension scaffold.
- Language server activation for Markdown and Markdown++ files.
- Render to HTML, export to PDF, and live preview commands.
- Node test coverage for binary naming, download URLs, and preview HTML.
