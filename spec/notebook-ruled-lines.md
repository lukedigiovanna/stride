# Notebook Ruled Lines — Alignment Fix

## Problem

The current `ruled-paper` implementation applies a `repeating-linear-gradient` as a CSS background on the main scrollable area. This draws horizontal lines every 28px regardless of what content is above them. Because content rows have variable heights (padding, different font sizes, multi-line text), the lines have no relationship to the text — they slice through letters, skip rows entirely, or appear in the middle of padding areas. This is most jarring in the Exercise list and History list where the background lines clearly don't match the row borders.

## Root Cause

A decorative background gradient cannot know where content lives. Text only aligns to a background grid if every single element's height, padding, and margin is a precise multiple of the grid interval (28px in our case). That level of control is essentially impossible to maintain across a full React app with flexible content.

## Proposed Solution: Row-Border Ruled Lines

**Remove the background gradient entirely.** Instead, the ruled lines ARE the content row separators — the `border-b border-border` that already exists on list rows.

This is actually more authentic to a real notebook. When you write in a composition notebook, the printed line sits *under* each line of text. The line is what you write on. In our UI, the bottom border of each row is that line — text sits above it naturally, perfectly, with no computation required.

### What changes

1. **Remove `ruled-paper` class** from `AppLayout.tsx` main element
2. **Remove `.ruled-paper` CSS utility** from `index.css`
3. **Audit all list rows** to ensure consistent `border-b border-border` — the line should appear under every discrete piece of content
4. **Standardize row height** — rows should feel like notebook lines, not cramped. Target ~48px minimum for primary rows (exercise rows, history rows, set rows). This means reviewing padding.
5. **Section headers** — give them a bottom border and/or `border-b border-foreground/20` to act like a ruled section heading underline
6. **Cards (stat tiles, user summary card)** — these are the one area that doesn't fit the row pattern. Options:
   - Keep them as "boxed" areas but with a more paper-like feel (very subtle border)
   - Or convert stats to a flat list of rows (e.g., `Label ........ Value` on a ruled line)

### What the result looks like

- Cream background, no diagonal-cutting lines
- Every list item has a ruled line exactly where content ends — text sits on it
- Section headings are underlined like notebook chapter headers
- Spacing is clean and breathable

## Alternative Considered: True Baseline Grid

Set `line-height: 28px` globally and make all padding a multiple of 28px, then offset the gradient to align with text baselines.

**Rejected** because:
- Requires every component to have heights that are multiples of 28px
- Breaks immediately with any multi-line text, icon-text rows, or input fields
- Extremely fragile — any small change to a component breaks the grid
- Still has the problem of lines appearing in empty padding areas

## Open Questions for Discussion

1. **Stats tiles vs. flat rows** — the current stat tile grid (3 tiles per row) doesn't fit naturally into a ruled-line pattern. Should we keep them as tiles (accepting they sit on cream paper without lines) or convert to a flat label-value list?

2. **Empty screens** — pages with no content (empty history, loading states) have no rows and thus no visible lines. Should we add placeholder lines to empty states to maintain the feel, or is clean cream paper fine there?

3. **The workout sheet** — the bottom sheet currently opens from the bottom. Should it also use row-border ruled lines throughout (which it mostly already does via set rows), or should the sheet feel like a fresh page (different shade of cream)?
