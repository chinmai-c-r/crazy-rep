# Crazy Rep brand

## The mark

A **kettlebell with "CR" in its body**: the weight is the gym, the letters are Crazy Rep (and Chinmai CR). The letters are cut
out of the bell, so they take the colour of whatever the mark sits on.

| File (`public/brand/`) | Use |
|---|---|
| `crazy-rep-mark.svg` | The main mark: a dark kettlebell with "CR" cut out, on a lime tile. App icons, store listings, social. |
| `crazy-rep-mark-dark.svg` | Lime-to-cyan gradient mark on a near-black tile. For dark backgrounds and splash screens. |
| `crazy-rep-glyph.svg` | The mark alone, no tile, in `currentColor`. For placing on a colour of your choice. |
| `crazy-rep-mark-small.svg` | A heavier version (thicker handle and letters), drawn for 16 to 48 px. Used for the favicon and the tab icon. |
| `crazy-rep-icon-1024.png`, `crazy-rep-icon-dark-1024.png` | 1024 px exports of the two tiles. |

In the code, the mark is defined once in `components/LogoMark.tsx` (`MARK`). The app logo, the landing page, the
onboarding header and the PWA and Apple icons (`app/icons/_render.tsx`) all draw from there, so changing it changes everywhere.
`app/icon.svg` and `app/favicon.ico` are made from the small version.

## The wordmark

**CRAZY REP** in Anton (the app's display font), letter spacing 0.04em. "CRAZY" in the text colour and "REP" in the accent colour.
In the app this is the `Logo` component (`components/Logo.tsx`): the lime tile with the mark, then the wordmark. The tile and the
accent follow the chosen theme.

## Colour

| | |
|---|---|
| Lime (primary) | `#c6ff00` |
| Ink | `#0a0a0c` |
| Gradient | `#c6ff00` to `#4dffb0` to `#00e5ff` |

Use ink on lime, lime or the gradient on dark. On a light background use the lime tile (the mark is dark on lime, so it holds up anywhere).

## Using it

- **Clear space:** keep at least a quarter of the tile's width free on every side.
- **Size:** the standard mark from 32 px up. Below that, use `crazy-rep-mark-small.svg`.
- **Don't:** stretch or rotate it, redraw the kettlebell or the letters, add shadows or outlines, or put the glyph on a busy photo without the tile.
