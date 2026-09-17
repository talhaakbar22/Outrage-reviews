import type { Session } from "@shopify/shopify-api";
import { createGraphqlClient } from "@/lib/shopify/client";
import type { RatingBreakdown } from "@/services/reviews/ratings";

/**
 * Storefront-facing namespace used by Dawn / Horizon “Show product rating”
 * and by Outrage widgets.
 *
 * Shopify standard keys (required for the theme toggle):
 *   - reviews.rating       (type: rating)  → { scale_min, scale_max, value }
 *   - reviews.rating_count (type: number_integer)
 *
 * Extra keys we keep for Outrage widgets / legacy:
 *   - reviews.count
 *   - reviews.rating_breakdown
 *   - reviews.customer_say
 */
export const RATING_METAFIELD_NAMESPACE = "reviews";

export const RATING_METAFIELD_KEYS = {
  rating: "rating",
  ratingCount: "rating_count",
  count: "count",
  ratingBreakdown: "rating_breakdown",
  customerSay: "customer_say",
} as const;

export type ProductRatingMetafields = {
  averageRating: number;
  reviewCount: number;
  ratingBreakdown: RatingBreakdown;
  /** Compact storefront snapshot so theme widgets stay in sync with stars. */
  customerSay?: Record<string, unknown> | null;
};

const METAFIELDS_SET_MUTATION = `#graphql
  mutation SetProductRatingMetafields($metafields: [MetafieldsSetInput!]!) {
    metafieldsSet(metafields: $metafields) {
      metafields {
        id
        namespace
        key
      }
      userErrors {
        field
        message
      }
    }
  }
`;

const METAFIELDS_DELETE_MUTATION = `#graphql
  mutation DeleteProductRatingMetafields($metafields: [MetafieldIdentifierInput!]!) {
    metafieldsDelete(metafields: $metafields) {
      deletedMetafields {
        key
        namespace
      }
      userErrors {
        field
        message
      }
    }
  }
`;

function buildRatingValue(averageRating: number) {
  return JSON.stringify({
    scale_min: "1.0",
    scale_max: "5.0",
    value: averageRating.toFixed(1),
  });
}

/**
 * Dawn / native theme rating uses type "rating" for reviews.rating.
 * Older Outrage writes used number_decimal — delete that key first so the
 * type can be upgraded cleanly.
 */
async function deleteLegacyDecimalRating(
  session: Session,
  productGid: string,
) {
  const client = createGraphqlClient(session);
  try {
    await client.request(METAFIELDS_DELETE_MUTATION, {
      variables: {
        metafields: [
          {
            ownerId: productGid,
            namespace: RATING_METAFIELD_NAMESPACE,
            key: RATING_METAFIELD_KEYS.rating,
          },
        ],
      },
    });
  } catch {
    // Best-effort: missing metafield is fine.
  }
}

export async function updateProductRatingMetafields(
  session: Session,
  productGid: string,
  ratings: ProductRatingMetafields,
) {
  const client = createGraphqlClient(session);

  // Upgrade path: remove legacy number_decimal rating before writing type=rating.
  await deleteLegacyDecimalRating(session, productGid);

  const metafields: Array<{
    ownerId: string;
    namespace: string;
    key: string;
    type: string;
    value: string;
  }> = [
    {
      ownerId: productGid,
      namespace: RATING_METAFIELD_NAMESPACE,
      key: RATING_METAFIELD_KEYS.rating,
      type: "rating",
      value: buildRatingValue(ratings.averageRating),
    },
    {
      ownerId: productGid,
      namespace: RATING_METAFIELD_NAMESPACE,
      key: RATING_METAFIELD_KEYS.ratingCount,
      type: "number_integer",
      value: String(ratings.reviewCount),
    },
    // Keep legacy key so older Outrage Liquid still works during rollout.
    {
      ownerId: productGid,
      namespace: RATING_METAFIELD_NAMESPACE,
      key: RATING_METAFIELD_KEYS.count,
      type: "number_integer",
      value: String(ratings.reviewCount),
    },
    {
      ownerId: productGid,
      namespace: RATING_METAFIELD_NAMESPACE,
      key: RATING_METAFIELD_KEYS.ratingBreakdown,
      type: "json",
      value: JSON.stringify(ratings.ratingBreakdown),
    },
  ];

  if (ratings.customerSay !== undefined) {
    metafields.push({
      ownerId: productGid,
      namespace: RATING_METAFIELD_NAMESPACE,
      key: RATING_METAFIELD_KEYS.customerSay,
      type: "json",
      value: JSON.stringify(ratings.customerSay ?? {}),
    });
  }

  const response = await client.request<{
    metafieldsSet: {
      userErrors: Array<{ field: string[] | null; message: string }>;
    };
  }>(METAFIELDS_SET_MUTATION, {
    variables: { metafields },
  });

  const errors = response.data?.metafieldsSet.userErrors ?? [];
  if (errors.length > 0) {
    throw new Error(
      errors.map((error) => error.message).join("; ") ||
        "Failed to update product rating metafields",
    );
  }
}
