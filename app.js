const INCH_TO_MM = 25.4;
const FRACTION_DENOM = 32;

function gcd(a, b) {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b !== 0) {
    const t = a % b;
    a = b;
    b = t;
  }
  return a;
}

class Fraction {
  constructor(n, d) {
    if (d === 0) {
      throw new Error("Division by zero.");
    }
    if (d < 0) {
      n = -n;
      d = -d;
    }
    const g = gcd(n, d);
    this.n = n / g;
    this.d = d / g;
  }

  static fromDecimalString(s) {
    const sign = s.startsWith("-") ? -1 : 1;
    const raw = s.replace(/^[-+]/, "");
    if (!raw.includes(".")) {
      return new Fraction(sign * parseInt(raw, 10), 1);
    }
    const parts = raw.split(".");
    const intPart = parts[0] || "0";
    const fracPart = parts[1] || "";
    const denom = Math.pow(10, fracPart.length);
    const num = parseInt(intPart, 10) * denom + parseInt(fracPart || "0", 10);
    return new Fraction(sign * num, denom);
  }

  add(other) {
    return new Fraction(this.n * other.d + other.n * this.d, this.d * other.d);
  }
  sub(other) {
    return new Fraction(this.n * other.d - other.n * this.d, this.d * other.d);
  }
  mul(other) {
    return new Fraction(this.n * other.n, this.d * other.d);
  }
  div(other) {
    if (other.n === 0) {
      throw new Error("Division by zero.");
    }
    return new Fraction(this.n * other.d, this.d * other.n);
  }
  toNumber() {
    return this.n / this.d;
  }
}

function normalizeMixedNumbers(expr) {
  let s = expr;
  s = s.replace(/(\d+)\s*-\s*(\d+)\s*\/\s*(\d+)/g, "($1 + $2/$3)");
  s = s.replace(/(\d+)\s+(\d+)\s*\/\s*(\d+)/g, "($1 + $2/$3)");
  return s;
}

function tokenize(expr) {
  const tokens = [];
  const s = normalizeMixedNumbers(expr);
  let i = 0;
  while (i < s.length) {
    const ch = s[i];
    if (/\s/.test(ch)) {
      i += 1;
      continue;
    }
    if ("+-*/()".includes(ch)) {
      tokens.push({ type: "op", value: ch });
      i += 1;
      continue;
    }
    if (/\d|\./.test(ch)) {
      let start = i;
      let hasDot = ch === ".";
      i += 1;
      while (i < s.length) {
        const c = s[i];
        if (c === ".") {
          if (hasDot) break;
          hasDot = true;
          i += 1;
          continue;
        }
        if (!/\d/.test(c)) break;
        i += 1;
      }
      let numStr = s.slice(start, i);
      if (!hasDot && s[i] === "/" && /\d/.test(s[i + 1] || "")) {
        i += 1; // skip '/'
        let denStart = i;
        while (i < s.length && /\d/.test(s[i])) i += 1;
        const denStr = s.slice(denStart, i);
        const frac = new Fraction(parseInt(numStr, 10), parseInt(denStr, 10));
        tokens.push({ type: "number", value: frac });
      } else {
        const frac = Fraction.fromDecimalString(numStr);
        tokens.push({ type: "number", value: frac });
      }
      continue;
    }
    throw new Error("Invalid characters in expression.");
  }
  return tokens;
}

function parseExpression(tokens) {
  let idx = 0;

  function peek() {
    return tokens[idx];
  }
  function consume() {
    return tokens[idx++];
  }

  function parseFactor() {
    const t = peek();
    if (!t) throw new Error("Invalid expression.");
    if (t.type === "op" && (t.value === "+" || t.value === "-")) {
      consume();
      const val = parseFactor();
      return t.value === "-" ? new Fraction(-val.n, val.d) : val;
    }
    if (t.type === "op" && t.value === "(") {
      consume();
      const val = parseExpr();
      const close = consume();
    if (!close || close.type !== "op" || close.value !== ")") {
      throw new Error("Missing closing parenthesis.");
    }
      return val;
    }
    if (t.type === "number") {
      consume();
      return t.value;
    }
    throw new Error("Invalid expression.");
  }

  function parseTerm() {
    let val = parseFactor();
    while (peek() && peek().type === "op" && (peek().value === "*" || peek().value === "/")) {
      const op = consume().value;
      const rhs = parseFactor();
      val = op === "*" ? val.mul(rhs) : val.div(rhs);
    }
    return val;
  }

  function parseExpr() {
    let val = parseTerm();
    while (peek() && peek().type === "op" && (peek().value === "+" || peek().value === "-")) {
      const op = consume().value;
      const rhs = parseTerm();
      val = op === "+" ? val.add(rhs) : val.sub(rhs);
    }
    return val;
  }

  const result = parseExpr();
  if (idx !== tokens.length) {
    throw new Error("Invalid expression.");
  }
  return result;
}

function evalFractionExpr(expr) {
  const tokens = tokenize(expr);
  return parseExpression(tokens);
}

function isExpression(text) {
  return /[+\-*/()]/.test(text) || /\d+\s*\/\s*\d+/.test(text) || /\d+\s+\d+\s*\/\s*\d+/.test(text);
}

function formatInchFraction(inches, denom = FRACTION_DENOM) {
  if (denom <= 0) return "";
  const sign = inches < 0 ? "-" : "";
  const value = Math.abs(inches);
  let whole = Math.floor(value);
  let frac = value - whole;
  let fracUnits = Math.round(frac * denom);
  if (fracUnits === denom) {
    whole += 1;
    fracUnits = 0;
  }
  if (fracUnits === 0) return `${sign}${whole}`;
  const g = gcd(fracUnits, denom);
  const n = fracUnits / g;
  const d = denom / g;
  return whole === 0 ? `${sign}${n}/${d}` : `${sign}${whole} ${n}/${d}`;
}

function normalizeInput(text) {
  return text
    .trim()
    .replace(/″/g, '"')
    .replace(/[“”]/g, '"');
}

function parseInput(text) {
  const s = normalizeInput(text);
  if (!s) throw new Error("Please enter a length.");

  const unitMatch = s.match(/^(.*?)(mm|cm|m|in|inch|inches|")$/i);
  if (unitMatch) {
    const exprPart = unitMatch[1].trim();
    const unit = unitMatch[2].toLowerCase();
    if (!exprPart) throw new Error("Please enter a value or expression.");
    const value = evalFractionExpr(exprPart).toNumber();
    if (unit === "mm") return { mm: value };
    if (unit === "cm") return { mm: value * 10 };
    if (unit === "m") return { mm: value * 1000 };
    const inchVal = value;
    return { mm: inchVal * INCH_TO_MM, inch: inchVal };
  }

  if (isExpression(s)) {
    const inchVal = evalFractionExpr(s).toNumber();
    return { mm: inchVal * INCH_TO_MM, inch: inchVal };
  }

  throw new Error('Unrecognized format. Add a unit like mm/cm/m or in/".');
}

function showResult(text, isError = false) {
  const el = document.getElementById("result");
  el.textContent = text;
  el.classList.toggle("error", isError);
}

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("convertForm");
  const input = document.getElementById("lengthInput");

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    try {
      const { mm, inch } = parseInput(input.value);
      const inchVal = inch ?? mm / INCH_TO_MM;
      const frac = formatInchFraction(inchVal);
      const msg = `= ${mm.toFixed(2)} mm   (inch: ${inchVal.toFixed(5)}" ~ ${frac}")`;
      showResult(msg, false);
    } catch (err) {
      showResult(err.message || "Invalid input.", true);
    }
  });
});
