# Self-hosted fonts

The site downloads one face: **Instrument Serif** (SIL Open Font License 1.1), for display
headings only. Body text and data use the system UI and monospace stacks, so they cost no
request.

| File | Loaded by the site | What it is |
| --- | --- | --- |
| `instrument-serif.woff2` | no | Full source, regular |
| `instrument-serif-latin.woff2` | yes, preloaded (19.9 KB) | Latin subset of the regular |

There is no italic: the site's font budget on `/` is 20 KB, and the italic face alone is 21 KB.
The `-latin` file is generated from the sources by groot's `scripts/media/subset-fonts.sh`
(pyftsubset in the `groot-tools` image). Re-run it after replacing a source file; the
`@font-face` rules live in `src/styles/base/_base.scss`.
