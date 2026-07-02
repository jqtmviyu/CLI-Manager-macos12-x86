import { toCssFontFamilyName } from "./systemFonts";

const DEFAULT_MONOSPACE_STACK = ["\"Cascadia Code\"", "Consolas", "monospace"] as const;
const GENERIC_MONOSPACE_TOKENS = new Set(["monospace", "ui-monospace"]);

const normalizeFamilyToken = (token: string) => token.trim().replace(/^['"]|['"]$/g, "");

const isGenericMonospaceToken = (token: string) =>
  GENERIC_MONOSPACE_TOKENS.has(normalizeFamilyToken(token).toLowerCase());

const dedupeTokens = (tokens: string[]) => {
  const seen = new Set<string>();
  return tokens.filter((token) => {
    const normalized = normalizeFamilyToken(token).toLowerCase();
    if (!normalized || seen.has(normalized)) return false;
    seen.add(normalized);
    return true;
  });
};

export function normalizeTerminalFontFamily(fontFamily: string) {
  const tokens = fontFamily
    .split(",")
    .map(toCssFontFamilyName)
    .filter(Boolean);

  if (tokens.length === 0) {
    return DEFAULT_MONOSPACE_STACK.join(", ");
  }

  const dedupedTokens = dedupeTokens(tokens);
  const genericMonospaceTokens = dedupedTokens.filter(isGenericMonospaceToken);
  const concreteTokens = dedupedTokens.filter((token) => !isGenericMonospaceToken(token));
  const orderedTokens = concreteTokens.length > 0
    ? [...concreteTokens, ...genericMonospaceTokens]
    : dedupedTokens;

  return dedupeTokens([...orderedTokens, "monospace"]).join(", ");
}
