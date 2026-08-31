import type { Session } from "@shopify/shopify-api";
import { createGraphqlClient } from "@/lib/shopify/client";
import {
  RATING_METAFIELD_KEYS,
  RATING_METAFIELD_NAMESPACE,
} from "@/lib/shopify/metafields";

export type ShopifyProductNode = {
  id: string;
  title: string;
  handle: string;
  status: string;
  featuredImage: { url: string } | null;
  averageRating: { value: string } | null;
  reviewCount: { value: string } | null;
};

export type ProductsPage = {
  products: ShopifyProductNode[];
  pageInfo: {
    hasNextPage: boolean;
    endCursor: string | null;
  };
};

const PRODUCTS_QUERY = `#graphql
  query SyncProducts($first: Int!, $after: String) {
    products(first: $first, after: $after) {
      pageInfo {
        hasNextPage
        endCursor
      }
      nodes {
        id
        title
        handle
        status
        featuredImage {
          url
        }
        averageRating: metafield(
          namespace: "${RATING_METAFIELD_NAMESPACE}"
          key: "${RATING_METAFIELD_KEYS.rating}"
        ) {
          value
        }
        reviewCount: metafield(
          namespace: "${RATING_METAFIELD_NAMESPACE}"
          key: "${RATING_METAFIELD_KEYS.count}"
        ) {
          value
        }
      }
    }
  }
`;

export async function fetchProductsPage(
  session: Session,
  cursor?: string | null,
  pageSize = 50,
): Promise<ProductsPage> {
  const client = createGraphqlClient(session);
  const response = await client.request<{
    products: {
      pageInfo: ProductsPage["pageInfo"];
      nodes: ShopifyProductNode[];
    };
  }>(PRODUCTS_QUERY, {
    variables: {
      first: pageSize,
      after: cursor ?? null,
    },
  });

  const products = response.data?.products;
  if (!products) {
    throw new Error("Failed to fetch products from Shopify");
  }

  return {
    products: products.nodes,
    pageInfo: products.pageInfo,
  };
}

export type ShopifyOrderNode = {
  id: string;
  name: string;
  email: string | null;
  displayFulfillmentStatus: string | null;
  customer: {
    id: string;
    email: string | null;
    firstName: string | null;
    lastName: string | null;
  } | null;
  lineItems: {
    nodes: Array<{
      id: string;
      title: string;
      quantity: number;
      sku: string | null;
      product: { id: string } | null;
    }>;
  };
};

export type OrdersPage = {
  orders: ShopifyOrderNode[];
  pageInfo: {
    hasNextPage: boolean;
    endCursor: string | null;
  };
};

const ORDERS_QUERY = `#graphql
  query SyncOrders($first: Int!, $after: String) {
    orders(first: $first, after: $after) {
      pageInfo {
        hasNextPage
        endCursor
      }
      nodes {
        id
        name
        email
        displayFulfillmentStatus
        customer {
          id
          email
          firstName
          lastName
        }
        lineItems(first: 50) {
          nodes {
            id
            title
            quantity
            sku
            product {
              id
            }
          }
        }
      }
    }
  }
`;

export async function fetchOrdersPage(
  session: Session,
  cursor?: string | null,
  pageSize = 50,
): Promise<OrdersPage> {
  const client = createGraphqlClient(session);
  const response = await client.request<{
    orders: {
      pageInfo: OrdersPage["pageInfo"];
      nodes: ShopifyOrderNode[];
    };
  }>(ORDERS_QUERY, {
    variables: {
      first: pageSize,
      after: cursor ?? null,
    },
  });

  const orders = response.data?.orders;
  if (!orders) {
    throw new Error("Failed to fetch orders from Shopify");
  }

  return {
    orders: orders.nodes,
    pageInfo: orders.pageInfo,
  };
}

export function mapShopifyProductStatus(
  status: string,
): "active" | "archived" | "draft" {
  switch (status.toUpperCase()) {
    case "ACTIVE":
      return "active";
    case "ARCHIVED":
      return "archived";
    case "DRAFT":
      return "draft";
    default:
      return "active";
  }
}

export function shopifyGidToId(gid: string) {
  return gid.split("/").pop() ?? gid;
}

export function parseProductRatings(product: ShopifyProductNode) {
  const avgRaw = product.averageRating?.value;
  const countRaw = product.reviewCount?.value;

  const avgRating =
    avgRaw !== undefined && avgRaw !== null && avgRaw !== ""
      ? Number.parseFloat(avgRaw)
      : null;

  const reviewCount =
    countRaw !== undefined && countRaw !== null && countRaw !== ""
      ? Number.parseInt(countRaw, 10)
      : 0;

  return {
    avgRating: Number.isFinite(avgRating ?? NaN) ? avgRating : null,
    reviewCount: Number.isFinite(reviewCount) ? reviewCount : 0,
  };
}
