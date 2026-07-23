import type { EntityManager } from 'typeorm';
import { ProductEntity } from '../products/entities/product.entity';

/**
 * Parses a free-text product prep time (e.g. "15 mins", "1 hr", "20") into a
 * number of minutes. Returns 0 when nothing parseable is found.
 */
export function parsePrepMinutes(prepTime?: string | null): number {
  if (!prepTime) return 0;
  const text = prepTime.toLowerCase();
  const match = text.match(/[\d.]+/);
  const num = match ? parseFloat(match[0]) : 0;
  if (!Number.isFinite(num) || num <= 0) return 0;
  // Treat "h"/"hr"/"hour" as hours; otherwise minutes.
  return /h(ou)?r?s?\b/.test(text) ? Math.round(num * 60) : Math.round(num);
}

/**
 * Order prep time = the longest single item prep time (client spec: "every item
 * on our menu has a prep time, so the prep time of an order is the prep time
 * from the item with the longest prep time"). Null when no line carries a
 * parseable prep time.
 *
 * Shared by the counter and the website order paths so both channels put the
 * same number on the kitchen board.
 */
export async function computeEstimatedPrepMinutes(
  manager: EntityManager,
  items: { productId?: string | null }[],
): Promise<number | null> {
  const productIds = Array.from(
    new Set(items.map((i) => i.productId).filter((id): id is string => !!id)),
  );
  if (productIds.length === 0) return null;
  const products = await manager
    .getRepository(ProductEntity)
    .find({ where: productIds.map((id) => ({ id })) });
  let max = 0;
  for (const p of products) {
    const mins = parsePrepMinutes(p.prepTime);
    if (mins > max) max = mins;
  }
  return max > 0 ? max : null;
}
