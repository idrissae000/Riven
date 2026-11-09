/**
 * Minimal parser for the subset of Lua the wiki uses in data modules:
 *   return { Key = "str", ["Quoted Key"] = { ... }, N = 12, B = true, Arr = { "a", "b" }, -- comment }
 * Handles strings (single/double quoted, escapes), numbers, booleans, nil, nested tables,
 * `--` line comments and `--[[ ]]` block comments. No expressions, no function calls.
 */
export type LuaValue = string | number | boolean | null | LuaValue[] | { [key: string]: LuaValue };

export function parseLuaModule(src: string): LuaValue {
  let i = 0;
  const peek = () => src[i];
  const fail = (msg: string): never => {
    const line = src.slice(0, i).split("\n").length;
    throw new Error(`Lua parse error at line ${line}: ${msg}`);
  };

  function skip() {
    for (;;) {
      while (i < src.length && /\s/.test(src[i])) i++;
      if (src.startsWith("--", i)) {
        if (src.startsWith("--[[", i)) {
          const end = src.indexOf("]]", i + 4);
          i = end < 0 ? src.length : end + 2;
        } else {
          while (i < src.length && src[i] !== "\n") i++;
        }
      } else return;
    }
  }

  function str(): string {
    const q = src[i++];
    let out = "";
    while (i < src.length && src[i] !== q) {
      if (src[i] === "\\") {
        const c = src[++i];
        out += c === "n" ? "\n" : c === "r" ? "\r" : c === "t" ? "\t" : c;
      } else out += src[i];
      i++;
    }
    if (src[i] !== q) fail("unterminated string");
    i++;
    return out;
  }

  function value(): LuaValue {
    skip();
    const c = peek();
    if (c === '"' || c === "'") return str();
    if (c === "{") return table();
    const m = /^(-?\d+(?:\.\d+)?(?:[eE][-+]?\d+)?)/.exec(src.slice(i, i + 40));
    if (m) { i += m[1].length; return Number(m[1]); }
    const w = /^[A-Za-z_]\w*/.exec(src.slice(i, i + 20));
    if (w) {
      i += w[0].length;
      if (w[0] === "true") return true;
      if (w[0] === "false") return false;
      if (w[0] === "nil") return null;
    }
    return fail(`unexpected token ${JSON.stringify(src.slice(i, i + 12))}`);
  }

  function table(): LuaValue {
    i++; // {
    const obj: { [k: string]: LuaValue } = {};
    const arr: LuaValue[] = [];
    for (;;) {
      skip();
      if (peek() === "}") { i++; break; }
      if (i >= src.length) fail("unterminated table");
      if (peek() === "[") {
        i++; skip();
        const key = peek() === '"' || peek() === "'" ? str() : String(value());
        skip();
        if (peek() !== "]") fail("expected ]");
        i++; skip();
        if (peek() !== "=") fail("expected =");
        i++;
        obj[key] = value();
      } else {
        const id = /^[A-Za-z_]\w*/.exec(src.slice(i, i + 80));
        const after = id ? src.slice(i + id[0].length).match(/^\s*=(?!=)/) : null;
        if (id && after) {
          i += id[0].length + after[0].length;
          obj[id[0]] = value();
        } else arr.push(value());
      }
      skip();
      if (peek() === "," || peek() === ";") i++;
    }
    const hasKeys = Object.keys(obj).length > 0;
    if (!hasKeys) return arr; // pure array (or empty table -> [])
    arr.forEach((v, n) => { obj[String(n + 1)] = v; }); // mixed table: positional items keep Lua's 1-based keys
    return obj;
  }

  skip();
  if (src.startsWith("return", i)) i += 6;
  else if (src.startsWith("local", i)) {
    // `local Name = { ... }` — parse that first table; anything after it (return, helper code) is ignored.
    const eq = src.indexOf("=", i);
    if (eq < 0) fail("expected = after local");
    i = eq + 1;
  }
  return value();
}
