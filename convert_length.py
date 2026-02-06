#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import re
from fractions import Fraction
import ast

INCH_TO_MM = 25.4
FRACTION_DENOM = 32

def _parse_inch_number(s: str) -> float:
    """
    Parse inch number formats:
    - "1.375"
    - "7/16"
    - "1 3/8"
    - "2-1/4"  (treated as "2 1/4")
    Returns decimal inches as float.
    """
    s = s.strip().lower()
    s = s.replace("-", " ")  # allow 2-1/4 style
    s = re.sub(r"\s+", " ", s)

    # If it's a plain decimal number
    if re.fullmatch(r"\d+(\.\d+)?", s):
        return float(s)

    # If it's a pure fraction like 7/16
    if re.fullmatch(r"\d+\s*/\s*\d+", s):
        return float(Fraction(s.replace(" ", "")))

    # If it's a mixed number like 1 3/8
    m = re.fullmatch(r"(\d+)\s+(\d+)\s*/\s*(\d+)", s)
    if m:
        whole = int(m.group(1))
        num = int(m.group(2))
        den = int(m.group(3))
        return whole + float(Fraction(num, den))

    raise ValueError(f"Invalid inch format: '{s}'")


def _is_inch_expression(text: str) -> bool:
    if re.search(r"[+\-*/()]", text):
        return True
    if re.search(r"\d+\s*/\s*\d+", text):
        return True
    if re.search(r"\d+\s+\d+\s*/\s*\d+", text):
        return True
    if re.search(r"\d+\s*-\s*\d+\s*/\s*\d+", text):
        return True
    return False


def _normalize_mixed_numbers(expr: str) -> str:
    expr = re.sub(r"(\d+)\s*-\s*(\d+)\s*/\s*(\d+)", r"(\1 + \2/\3)", expr)
    expr = re.sub(r"(\d+)\s+(\d+)\s*/\s*(\d+)", r"(\1 + \2/\3)", expr)
    return expr


def _eval_fraction_expr(expr: str) -> Fraction:
    expr = _normalize_mixed_numbers(expr)
    if re.search(r"[^0-9+\-*/().\s]", expr):
        raise ValueError("Invalid characters in expression.")

    node = ast.parse(expr, mode="eval")

    def _eval(n: ast.AST) -> Fraction:
        if isinstance(n, ast.Expression):
            return _eval(n.body)
        if isinstance(n, ast.Constant) and isinstance(n.value, (int, float)):
            return Fraction(str(n.value))
        if isinstance(n, ast.UnaryOp) and isinstance(n.op, (ast.UAdd, ast.USub)):
            val = _eval(n.operand)
            return val if isinstance(n.op, ast.UAdd) else -val
        if isinstance(n, ast.BinOp) and isinstance(
            n.op, (ast.Add, ast.Sub, ast.Mult, ast.Div)
        ):
            left = _eval(n.left)
            right = _eval(n.right)
            if isinstance(n.op, ast.Add):
                return left + right
            if isinstance(n.op, ast.Sub):
                return left - right
            if isinstance(n.op, ast.Mult):
                return left * right
            if isinstance(n.op, ast.Div):
                if right == 0:
                    raise ValueError("Division by zero.")
                return left / right
        raise ValueError("Invalid expression.")

    return _eval(node)


def _format_inch_fraction(inches: float, denom: int = FRACTION_DENOM) -> str:
    if denom <= 0:
        raise ValueError("Denominator must be positive.")

    sign = "-" if inches < 0 else ""
    value = abs(inches)
    whole = int(value)
    frac = value - whole

    frac_units = int(round(frac * denom))
    if frac_units == denom:
        whole += 1
        frac_units = 0

    if frac_units == 0:
        return f"{sign}{whole}"

    reduced = Fraction(frac_units, denom)
    if whole == 0:
        return f"{sign}{reduced.numerator}/{reduced.denominator}"
    return f"{sign}{whole} {reduced.numerator}/{reduced.denominator}"


def parse_length_to_mm(text: str) -> tuple[float, float | None]:
    """
    Returns (mm_value, inch_value_if_applicable).
    - If input is metric, inch_value_if_applicable is None.
    - If input is inch, returns inch decimal too.
    """
    raw = text.strip()
    if not raw:
        raise ValueError("Empty input.")

    s = raw.strip().lower()
    s = s.replace("″", '"')  # smart double prime to "
    s = s.replace("”", '"').replace("“", '"')
    s = s.strip()

    # Normalize: remove spaces around unit
    s = re.sub(r"\s+", " ", s)

    # Detect metric first: mm / cm / m
    metric_match = re.fullmatch(r"([0-9]+(?:\.[0-9]+)?)\s*(mm|cm|m)", s)
    if metric_match:
        value = float(metric_match.group(1))
        unit = metric_match.group(2)
        if unit == "mm":
            return value, None
        if unit == "cm":
            return value * 10.0, None
        if unit == "m":
            return value * 1000.0, None

    # Detect inch: allow trailing "in" or quotes "
    # Examples: 1", 1.375", 1 3/8", 2-1/4", 7/16in
    inch_match = re.fullmatch(r"(.+?)\s*(in|\"|inch|inches)", s)
    if inch_match:
        number_part = inch_match.group(1).strip()
        if _is_inch_expression(number_part):
            inch_val = float(_eval_fraction_expr(number_part))
        else:
            inch_val = _parse_inch_number(number_part)
        mm_val = inch_val * INCH_TO_MM
        return mm_val, inch_val

    # Expression without unit: treat as inches if it looks like an expression.
    if _is_inch_expression(s):
        inch_val = float(_eval_fraction_expr(s))
        mm_val = inch_val * INCH_TO_MM
        return mm_val, inch_val

    # If user types bare number, we do NOT guess (too risky in shop).
    raise ValueError(
        "Unrecognized format. Add a unit like mm/cm/m or in/\n"
        "Examples: 25mm, 2.5cm, 0.75m, 1\", 1 3/8\", 7/16in"
    )


def main():
    print("Length Converter (MVP) — enter a value, get mm.")
    print("Examples: 25mm | 2.5cm | 0.75m | 1\" | 1 3/8\" | 7/16in")
    print("Expr: 3/4 + 1/16 | (1 3/8) * 2")
    print(f"Fraction precision: 1/{FRACTION_DENOM} inch")
    print("Type 'q' to quit.\n")

    while True:
        user = input("Enter length: ").strip()
        if user.lower() in {"q", "quit", "exit"}:
            break
        try:
            mm, inch = parse_length_to_mm(user)
            if inch is None:
                inch_val = mm / INCH_TO_MM
                frac = _format_inch_fraction(inch_val)
                print(f"= {mm:.2f} mm   (inch: {inch_val:.5f}\" ~ {frac}\")\n")
            else:
                frac = _format_inch_fraction(inch)
                print(f"= {mm:.2f} mm   (inch: {inch:.5f}\" ~ {frac}\")\n")
        except Exception as e:
            print(f"Error: {e}\n")


if __name__ == "__main__":
    main()
