export type ProductCsvRow = {
  handle: string;
  title: string;
  shopifyProductId: string | null;
  imageUrl: string | null;
  status: "active" | "archived" | "draft";
};

const COLUMN_ALIASES: Record<keyof ProductCsvRow | "shopifyProductId", string[]> = {
  handle: ["handle", "product_handle", "product handle", "url handle"],
  title: ["title", "product_title", "name", "product name"],
  shopifyProductId: [
    "product_id",
    "productid",
    "shopify_product_id",
    "shopify product id",
    "id",
  ],
  imageUrl: [
    "image_url",
    "image_src",
    "image src",
    "img",
    "featured_image",
    "image",
  ],
  status: ["status", "published", "product_status"],
};

function normalizeHeader(header: string) {
  return header.trim().toLowerCase().replace(/\s+/g, "_");
}

function parseCsv(content: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < content.length; i += 1) {
    const char = content[i];
    const next = content[i + 1];

    if (inQuotes) {
      if (char === '"' && next === '"') {
        field += '"';
        i += 1;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
      continue;
    }

    if (char === ",") {
      row.push(field);
      field = "";
      continue;
    }

    if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      continue;
    }

    if (char === "\r") {
      continue;
    }

    field += char;
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows.filter((cells) => cells.some((cell) => cell.trim().length > 0));
}

function buildHeaderMap(headers: string[]) {
  const normalized = headers.map(normalizeHeader);
  const map: Partial<Record<keyof ProductCsvRow, number>> = {};

  for (const [canonical, aliases] of Object.entries(COLUMN_ALIASES) as Array<
    [keyof ProductCsvRow, string[]]
  >) {
    const index = normalized.findIndex((header) =>
      aliases.some((alias) => normalizeHeader(alias) === header),
    );
    if (index >= 0) {
      map[canonical] = index;
    }
  }

  return map;
}

function cell(
  row: string[],
  map: Partial<Record<keyof ProductCsvRow, number>>,
  key: keyof ProductCsvRow,
) {
  const index = map[key];
  if (index == null) return "";
  return (row[index] ?? "").trim();
}

function mapStatus(raw: string): "active" | "archived" | "draft" {
  const value = raw.trim().toLowerCase();
  if (value === "archived" || value === "unlisted") return "archived";
  if (value === "draft" || value === "false" || value === "unpublished") {
    return "draft";
  }
  if (value === "active" || value === "true" || value === "published" || !value) {
    return "active";
  }
  return "active";
}

function normalizeShopifyId(raw: string) {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const digits = trimmed.replace(/\D/g, "");
  return digits || trimmed;
}

function normalizeHandle(raw: string) {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  try {
    if (trimmed.includes("/products/")) {
      const url = new URL(
        trimmed.startsWith("http") ? trimmed : `https://example.com${trimmed}`,
      );
      const match = url.pathname.match(/\/products\/([^/?#]+)/i);
      if (match?.[1]) return decodeURIComponent(match[1]);
    }
  } catch {
    // fall through
  }
  return trimmed.replace(/^\/+|\/+$/g, "");
}

/**
 * Shopify product export CSVs repeat the handle on variant/image rows.
 * Keep the first meaningful row per handle.
 */
export function parseProductCsv(content: string): {
  rows: ProductCsvRow[];
  parseErrors: string[];
} {
  const table = parseCsv(content);
  if (table.length < 2) {
    return { rows: [], parseErrors: ["CSV has no data rows"] };
  }

  const [headerRow, ...dataRows] = table;
  const map = buildHeaderMap(headerRow ?? []);
  if (map.handle == null && map.shopifyProductId == null) {
    return {
      rows: [],
      parseErrors: [
        "CSV must include a Handle column and/or a Product ID / Shopify Product ID column",
      ],
    };
  }

  const parseErrors: string[] = [];
  const byKey = new Map<string, ProductCsvRow>();

  dataRows.forEach((row, index) => {
    const handle = normalizeHandle(cell(row, map, "handle"));
    const shopifyProductId = normalizeShopifyId(
      cell(row, map, "shopifyProductId"),
    );
    const title = cell(row, map, "title") || handle || shopifyProductId || "";
    const imageUrl = cell(row, map, "imageUrl") || null;
    const status = mapStatus(cell(row, map, "status"));

    if (!handle && !shopifyProductId) {
      parseErrors.push(`Row ${index + 2}: missing handle and product id`);
      return;
    }

    const key = handle || `id:${shopifyProductId}`;
    const existing = byKey.get(key);
    if (existing) {
      if (!existing.imageUrl && imageUrl) existing.imageUrl = imageUrl;
      if (!existing.title && title) existing.title = title;
      if (!existing.shopifyProductId && shopifyProductId) {
        existing.shopifyProductId = shopifyProductId;
      }
      return;
    }

    byKey.set(key, {
      handle: handle || `product-${shopifyProductId}`,
      title: title || handle || `Product ${shopifyProductId}`,
      shopifyProductId,
      imageUrl,
      status,
    });
  });

  return {
    rows: [...byKey.values()],
    parseErrors: parseErrors.slice(0, 50),
  };
}
