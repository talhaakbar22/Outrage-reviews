import { config } from "dotenv";
import { getDb } from "../lib/prisma";
import { generateAndStoreProductSummary } from "../services/reviews/ai-summary";

config();

async function main() {
  const shopDomain = process.argv[2] || "test-lcoemihp.myshopify.com";
  const productHint = process.argv[3];
  const db = getDb();
  const shop = await db.orm.public.Shop.where({ shopifyDomain: shopDomain }).first();
  if (!shop) {
    throw new Error(`Shop not found: ${shopDomain}`);
  }

  const products = await db.orm.public.Product.where({ shopId: shop.id })
    .orderBy((product) => product.reviewCount.desc())
    .limit(20)
    .all();

  const target = productHint
    ? products.find(
        (product) =>
          product.id === productHint ||
          product.shopifyProductId === productHint ||
          product.title.toLowerCase().includes(productHint.toLowerCase()),
      )
    : products.find((product) => Number(product.reviewCount) > 0);

  if (!target) {
    throw new Error("No matching product with reviews");
  }

  const result = await generateAndStoreProductSummary({
    shopId: shop.id,
    productId: target.id,
    productTitle: target.title,
    avgRating: target.avgRating,
    force: true,
  });

  console.log(
    JSON.stringify(
      {
        product: target.title,
        modelVersion: result?.modelVersion,
        summaryText: result?.summaryText,
        highlights: result?.highlights,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
