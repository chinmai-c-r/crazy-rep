/**
 * A box that sits inside a card (a row in a list, a stat tile) loses its own border, fill and corners on a phone:
 * the card is already the box, and a second frame inside it only eats width. Wider screens keep the boxed look.
 * Add these after the box's own classes; the `max-sm:` versions win on phones.
 */

/** A row in a list: no frame, a hairline between neighbours (none above the first). */
export const flatRow = "max-sm:rounded-none max-sm:border-0 max-sm:border-t max-sm:bg-transparent max-sm:bg-none max-sm:px-0 max-sm:shadow-none max-sm:ring-0 max-sm:first:border-t-0";

/** A tile in a grid: no frame or fill (the grid's spacing separates them). */
export const flatTile = "max-sm:rounded-none max-sm:border-0 max-sm:bg-transparent max-sm:px-0 max-sm:shadow-none max-sm:ring-0";
