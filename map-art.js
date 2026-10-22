/* BRPG Map & Dungeon Art Renderer.
 * Connects reviewed asset sheets (1145x1374, 5x6 cells, 229px squares) to the exploration Canvas.
 */
(() => {
  'use strict';

  const sheets = {
    structures: { src: 'map_sheet01_structures.png', width: 1145, height: 1374 },
    hazards:    { src: 'map_sheet02_hazards.png',    width: 1145, height: 1374 },
    forest:     { src: 'map_sheet03_forest.png',     width: 1145, height: 1374 },
    dungeon:    { src: 'map_sheet04_dungeon.png',    width: 1145, height: 1374 }
  };

  const images = {};

  // Preload sprite sheets in browser environment
  if (typeof Image !== 'undefined') {
    for (const [key, meta] of Object.entries(sheets)) {
      const img = new Image();
      img.src = meta.src;
      img.onload = () => {
        // Redraw active dungeon if canvas is present
        if (typeof globalThis.draw === 'function' && globalThis.s?.dungeon) {
          globalThis.draw();
        }
        if (globalThis.s?.view === 'explore' && typeof globalThis.render === 'function') {
          globalThis.render();
        }
      };
      images[key] = img;
    }
  }

  const BRPGMapArt = {
    sheets,
    images,
    isReady(sheetKey) {
      const img = images[sheetKey];
      return !!(img && img.complete && img.naturalWidth > 0);
    },
    /**
     * Draw a single cell from a sprite sheet to the 2D canvas context.
     * @param {CanvasRenderingContext2D} ctx Target 2D context
     * @param {string} sheetKey Key in sheets ('structures', 'hazards', 'forest', 'dungeon')
     * @param {number} col 0-indexed column (0..4)
     * @param {number} row 0-indexed row (0..5)
     * @param {number} dx Destination X on canvas
     * @param {number} dy Destination Y on canvas
     * @param {number} dw Destination width
     * @param {number} dh Destination height
     * @returns {boolean} True if sprite was drawn, false if fallback is needed
     */
    drawCell(ctx, sheetKey, col, row, dx, dy, dw, dh) {
      if (!ctx || typeof ctx.drawImage !== 'function') return false;
      const img = images[sheetKey];
      if (!img || !img.complete || img.naturalWidth === 0) return false;
      const cellW = 229, cellH = 229;
      const sx = col * cellW;
      const sy = row * cellH;
      try {
        ctx.drawImage(img, sx, sy, cellW, cellH, dx, dy, dw, dh);
        return true;
      } catch {
        return false;
      }
    },
    /**
     * Determine the biome ('forest' or 'dungeon') for the current floor.
     */
    getBiome(dungeon) {
      if (!dungeon) return 'forest';
      const mapId = dungeon.mapId || '';
      if (mapId.includes('dungeon') || mapId.includes('ruin') || mapId.includes('mine') || mapId.includes('cave')) {
        return 'dungeon';
      }
      return 'forest'; // default biome is forest_edge
    }
  };

  globalThis.BRPGMapArt = BRPGMapArt;
})();
