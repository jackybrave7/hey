/**
 * Умная компоновка N фото в квадратный коллаж.
 * Контейнер всегда 1:1; ячейки — с span'ами (как в Telegram/iMessage).
 */

function cell(index, col, row, colSpan = 1, rowSpan = 1) {
  return { index, col, row, colSpan, rowSpan };
}

/** Шаблоны 1–10 фото: cols/rows + позиции (col/row — с 1) */
const TEMPLATES = {
  1: { cols: 1, rows: 1, cells: [cell(0, 1, 1)] },
  2: { cols: 2, rows: 1, cells: [cell(0, 1, 1), cell(1, 2, 1)] },
  3: {
    cols: 2, rows: 2,
    cells: [cell(0, 1, 1, 1, 2), cell(1, 2, 1), cell(2, 2, 2)],
  },
  4: {
    cols: 2, rows: 2,
    cells: [cell(0, 1, 1), cell(1, 2, 1), cell(2, 1, 2), cell(3, 2, 2)],
  },
  5: {
    cols: 2, rows: 3,
    cells: [
      cell(0, 1, 1, 1, 2), cell(1, 2, 1), cell(2, 2, 2),
      cell(3, 1, 3), cell(4, 2, 3),
    ],
  },
  6: {
    cols: 3, rows: 2,
    cells: [
      cell(0, 1, 1), cell(1, 2, 1), cell(2, 3, 1),
      cell(3, 1, 2), cell(4, 2, 2), cell(5, 3, 2),
    ],
  },
  7: {
    cols: 3, rows: 3,
    cells: [
      cell(0, 1, 1), cell(1, 2, 1), cell(2, 3, 1),
      cell(3, 1, 2), cell(4, 2, 2), cell(5, 3, 2),
      cell(6, 1, 3, 3, 1),
    ],
  },
  8: {
    cols: 4, rows: 2,
    cells: [
      cell(0, 1, 1), cell(1, 2, 1), cell(2, 3, 1), cell(3, 4, 1),
      cell(4, 1, 2), cell(5, 2, 2), cell(6, 3, 2), cell(7, 4, 2),
    ],
  },
  9: {
    cols: 3, rows: 3,
    cells: [
      cell(0, 1, 1), cell(1, 2, 1), cell(2, 3, 1),
      cell(3, 1, 2), cell(4, 2, 2), cell(5, 3, 2),
      cell(6, 1, 3), cell(7, 2, 3), cell(8, 3, 3),
    ],
  },
  10: {
    cols: 5, rows: 2,
    cells: [
      cell(0, 1, 1), cell(1, 2, 1), cell(2, 3, 1), cell(3, 4, 1), cell(4, 5, 1),
      cell(5, 1, 2), cell(6, 2, 2), cell(7, 3, 2), cell(8, 4, 2), cell(9, 5, 2),
    ],
  },
};

/**
 * @param {number} count — число фото
 * @returns {{
 *   cols: number,
 *   rows: number,
 *   cells: Array<{ index: number, col: number, row: number, colSpan: number, rowSpan: number }>,
 *   visibleCount: number,
 *   overlayIndex: number | null,
 *   overlayLabel: string | null,
 * }}
 */
export function squareGalleryLayout(count) {
  const n = Math.max(0, count | 0);
  if (n === 0) {
    return { cols: 1, rows: 1, cells: [], visibleCount: 0, overlayIndex: null, overlayLabel: null };
  }

  // Больше 10 — показываем 9 плиток, на последней «+N»
  if (n > 10) {
    const base = TEMPLATES[9];
    return {
      ...base,
      visibleCount: 9,
      overlayIndex: 8,
      overlayLabel: `+${n - 8}`,
    };
  }

  const base = TEMPLATES[n];
  return {
    ...base,
    visibleCount: n,
    overlayIndex: null,
    overlayLabel: null,
  };
}
