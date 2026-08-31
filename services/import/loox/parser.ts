import type { LooxCsvRow } from "@/services/import/loox/types";

const COLUMN_ALIASES: Record<string, string[]> = {
  externalId: ["id", "review_id", "loox_id"],
  productHandle: ["product_handle", "handle", "product handle"],
  shopifyProductId: ["product_id", "productid", "shopify_product_id"],
  rating: ["rating", "stars", "score"],
  title: ["title", "review_title"],
  body: ["body", "review", "review_text", "content", "comment"],
  reviewerName: ["author", "reviewer_name", "reviewer", "nickname", "name"],
  reviewerEmail: ["email", "reviewer_email"],
  createdAt: ["created_at", "date", "review_date", "created"],
  photoUrls: ["photo_url", "photo_urls", "image_url", "img", "media_url", "photos", "image"],
  merchantReply: ["reply", "merchant_reply", "store_reply"],
  merchantRepliedAt: ["replied_at", "reply_date"],
  isVerifiedPurchase: ["verified_purchase", "verified", "verified_buyer"],
  status: ["status", "review_status"],
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
  const map = new Map<string, string>();

  for (const header of headers) {
    const normalized = normalizeHeader(header);
    map.set(normalized, header);

    for (const [canonical, aliases] of Object.entries(COLUMN_ALIASES)) {
      if (aliases.includes(normalized)) {
        map.set(canonical, header);
      }
    }
  }

  return map;
}

function getCell(
  record: Record<string, string>,
  headerMap: Map<string, string>,
  key: keyof typeof COLUMN_ALIASES,
) {
  const header = headerMap.get(key);
  if (!header) {
    return "";
  }
  return (record[header] ?? "").trim();
}

function parseRating(raw: string) {
  const rating = Number.parseInt(raw, 10);
  if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
    throw new Error(`Invalid rating "${raw}"`);
  }
  return rating;
}

function parseDate(raw: string, fieldName: string) {
  if (!raw) {
    throw new Error(`Missing ${fieldName}`);
  }

  const iso = raw.includes("T") ? raw : `${raw}T00:00:00.000Z`;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid date "${raw}" for ${fieldName}`);
  }
  return date;
}

function parseOptionalDate(raw: string) {
  if (!raw) {
    return null;
  }
  return parseDate(raw, "replied_at");
}

function parseBoolean(raw: string) {
  const value = raw.trim().toLowerCase();
  return value === "true" || value === "1" || value === "yes";
}

function parsePhotoUrls(raw: string) {
  if (!raw) {
    return [];
  }

  return raw
    .split(",")
    .map((url) => url.trim())
    .filter(Boolean)
    .map((url) => (url.startsWith("http") ? url : `https://${url}`));
}

function parseStatus(raw: string): LooxCsvRow["status"] {
  const value = raw.trim().toLowerCase();
  if (!value || value === "published" || value === "active" || value === "approved") {
    return "published";
  }
  if (value === "rejected" || value === "spam") {
    return "rejected";
  }
  return "pending";
}

function normalizeShopifyProductId(raw: string) {
  if (!raw) {
    return null;
  }

  const trimmed = raw.trim();
  const gidMatch = trimmed.match(/Product\/(\d+)/i);
  if (gidMatch) {
    return gidMatch[1];
  }

  return trimmed.replace(/\D/g, "") || null;
}

function buildExternalId(record: Record<string, string>, headerMap: Map<string, string>, index: number) {
  const explicit = getCell(record, headerMap, "externalId");
  if (explicit) {
    return `loox:${explicit}`;
  }

  const productId = normalizeShopifyProductId(getCell(record, headerMap, "shopifyProductId")) ?? "unknown";
  const createdAt = getCell(record, headerMap, "createdAt");
  const author = getCell(record, headerMap, "reviewerName");
  const body = getCell(record, headerMap, "body");
  return `loox:row:${index}:${productId}:${createdAt}:${author}:${body.slice(0, 32)}`;
}

export function parseLooxCsv(content: string): {
  rows: LooxCsvRow[];
  parseErrors: string[];
} {
  const table = parseCsv(content);
  if (table.length === 0) {
    return { rows: [], parseErrors: [] };
  }

  const [headerRow, ...dataRows] = table;
  const headerMap = buildHeaderMap(headerRow);
  const rows: LooxCsvRow[] = [];
  const parseErrors: string[] = [];

  dataRows.forEach((cells, index) => {
    try {
      const record: Record<string, string> = {};
      headerRow.forEach((header, cellIndex) => {
        record[header] = cells[cellIndex] ?? "";
      });

      const body = getCell(record, headerMap, "body");
      if (!body) {
        return;
      }

      rows.push({
        externalId: buildExternalId(record, headerMap, index + 1),
        productHandle: getCell(record, headerMap, "productHandle") || null,
        shopifyProductId: normalizeShopifyProductId(
          getCell(record, headerMap, "shopifyProductId"),
        ),
        rating: parseRating(getCell(record, headerMap, "rating")),
        title: getCell(record, headerMap, "title") || null,
        body,
        reviewerName: getCell(record, headerMap, "reviewerName") || null,
        reviewerEmail: getCell(record, headerMap, "reviewerEmail") || null,
        createdAt: parseDate(getCell(record, headerMap, "createdAt"), "created_at"),
        photoUrls: parsePhotoUrls(getCell(record, headerMap, "photoUrls")),
        merchantReply: getCell(record, headerMap, "merchantReply") || null,
        merchantRepliedAt: parseOptionalDate(getCell(record, headerMap, "merchantRepliedAt")),
        isVerifiedPurchase: parseBoolean(getCell(record, headerMap, "isVerifiedPurchase")),
        status: parseStatus(getCell(record, headerMap, "status")),
      });
    } catch (error) {
      parseErrors.push(
        `Row ${index + 2}: ${error instanceof Error ? error.message : "Invalid row"}`,
      );
    }
  });

  return { rows, parseErrors };
}
