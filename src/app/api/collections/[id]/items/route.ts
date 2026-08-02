import { importItems } from "@/server/services/collection.service";
import { parseItemList } from "@/core/domain/itemImport";
import { ApiError, parseBody, withAuth } from "@/server/http/handler";
import {
  importItemsSchema,
  importTextSchema,
  MAX_IMPORT_ITEMS,
} from "@/server/validation/collection.schema";

type Params = { id: string };

/**
 * POST /api/collections/[id]/items
 *
 * Accepts either a parsed `items` array or a raw `text` paste. Parsing the raw
 * form server-side means the client and the API can never disagree about what
 * a given paste produces.
 */
export const POST = withAuth<Params>(async ({ userId, request, params }) => {
  const body: unknown = await request.json().catch(() => null);

  if (body && typeof body === "object" && "text" in body) {
    const { text } = importTextSchema.parse(body);
    const parsed = parseItemList(text);

    if (parsed.items.length === 0) {
      throw ApiError.badRequest("Nothing importable found", { issues: parsed.issues });
    }
    if (parsed.items.length > MAX_IMPORT_ITEMS) {
      throw ApiError.badRequest(`Too many items — the limit is ${MAX_IMPORT_ITEMS} per import`);
    }

    const result = await importItems(userId, params.id, { items: parsed.items });
    // Parse issues travel back so the user can fix the lines that failed.
    return { ...result, issues: parsed.issues, duplicatesInPaste: parsed.duplicates };
  }

  const input = importItemsSchema.parse(body);
  return { ...(await importItems(userId, params.id, input)), issues: [], duplicatesInPaste: 0 };
});
