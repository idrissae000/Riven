/**
 * Strict parser for JavaScript *literals* (arrays, objects, numbers, strings, booleans, null) — used to read the
 * data tables out of a third-party page's inline script WITHOUT executing any of its code.
 * Supports: `.45` / `-.495` / `1e3` numbers, '…' and "…" strings with escapes, unquoted identifier keys,
 * trailing commas, and // or /* comments. Anything else (identifiers as values, calls, operators) throws.
 */
export type JsValue = string | number | boolean | null | JsValue[] | { [key: string]: JsValue };

export function parseJsLiteral(src: string): JsValue {
  let i = 0;
  const fail = (msg: string): never => {
    throw new Error(`JS literal parse error at offset ${i}: ${msg} near ${JSON.stringify(src.slice(i, i + 24))}`);
  };

  function skip() {
    for (;;) {
      while (i < src.length && /\s/.test(src[i])) i++;
      if (src.startsWith("//", i)) { while (i < src.length && src[i] !== "\n") i++; }
      else if (src.startsWith("/*", i)) { const end = src.indexOf("*/", i + 2); i = end < 0 ? src.length : end + 2; }
      else return;
    }
  }

  function str(): string {
    const q = src[i++];
    let out = "";
    while (i < src.length && src[i] !== q) {
      if (src[i] === "\\") {
        const c = src[++i];
        if (c === "u") { out += String.fromCharCode(parseInt(src.slice(i + 1, i + 5), 16)); i += 4; }
        else out += c === "n" ? "\n" : c === "t" ? "\t" : c === "r" ? "\r" : c;
      } else out += src[i];
      i++;
    }
    if (src[i] !== q) fail("unterminated string");
    i++;
    return out;
  }

  function value(): JsValue {
    skip();
    const c = src[i];
    if (c === '"' || c === "'") return str();
    if (c === "[") {
      i++;
      const arr: JsValue[] = [];
      for (;;) {
        skip();
        if (src[i] === "]") { i++; return arr; }
        arr.push(value());
        skip();
        if (src[i] === ",") i++;
        else if (src[i] !== "]") fail("expected , or ]");
      }
    }
    if (c === "{") {
      i++;
      const obj: { [k: string]: JsValue } = {};
      for (;;) {
        skip();
        if (src[i] === "}") { i++; return obj; }
        let key: string;
        if (src[i] === '"' || src[i] === "'") key = str();
        else {
          const m = /^[A-Za-z_$][\w$]*/.exec(src.slice(i, i + 64));
          if (!m) return fail("expected object key");
          key = m[0];
          i += key.length;
        }
        skip();
        if (src[i] !== ":") fail("expected :");
        i++;
        obj[key] = value();
        skip();
        if (src[i] === ",") i++;
        else if (src[i] !== "}") fail("expected , or }");
      }
    }
    const num = /^[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/.exec(src.slice(i, i + 40));
    if (num) { i += num[0].length; return Number(num[0]); }
    const word = /^[A-Za-z_]+/.exec(src.slice(i, i + 12))?.[0];
    if (word === "true") { i += 4; return true; }
    if (word === "false") { i += 5; return false; }
    if (word === "null") { i += 4; return null; }
    return fail("unsupported token");
  }

  const v = value();
  skip();
  return v;
}

/** Returns the text of the balanced [...] / {...} literal that starts at `src[start]` (which must be the opening bracket). */
export function balancedLiteral(src: string, start: number): string {
  const open = src[start];
  const close = open === "[" ? "]" : open === "{" ? "}" : null;
  if (!close) throw new Error(`Expected [ or { at offset ${start}`);
  let depth = 0;
  let quote: string | null = null;
  for (let i = start; i < src.length; i++) {
    const c = src[i];
    if (quote) { if (c === "\\") i++; else if (c === quote) quote = null; continue; }
    if (c === '"' || c === "'" || c === "`") quote = c;
    else if (c === open) depth++;
    else if (c === close && --depth === 0) return src.slice(start, i + 1);
  }
  throw new Error(`Unbalanced literal starting at offset ${start}`);
}
