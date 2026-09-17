import type { Session } from "@shopify/shopify-api";
import { createGraphqlClient } from "@/lib/shopify/client";
import type { RatingBreakdown } from "@/services/reviews/ratings";

/** Storefront-facing namespace: reviews.rating / reviews.count / reviews.rating_breakdown */
export const RATING_METAFIELD_NAMESPACE = "reviews";

export const RATING_METAFIELD_KEYS = {
  rating: "rating",
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

export async function updateProductRatingMetafields(
  session: Session,
  productGid: string,
  ratings: ProductRatingMetafields,
) {
  const client = createGraphqlClient(session);
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
      type: "number_decimal",
      value: ratings.averageRating.toFixed(2),
    },
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
