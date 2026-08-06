import { describe, expect, it } from "vitest";
import { amountInWords, calculateTotals, formatPKR, numberToWords, toPaisa, toRupees } from "../calculations";

describe("money helpers", () => {
  it("converts rupees to paisa without float drift", () => {
    expect(toPaisa(1800) * 350).toBe(63000000); // 350 heads at Rs 1,800
    expect(toPaisa(957000.5)).toBe(95700050);
  });

  it("converts paisa back to rupees", () => {
    expect(toRupees(95700050)).toBe(957000.5);
  });

  it("formats paisa as PKR with the Rs prefix", () => {
    expect(formatPKR(99825000)).toBe("Rs 998,250");
  });
});

const SALES_TAX = { id: "t1", name: "Sales Tax", rateBps: 1600 };

describe("calculateTotals — inclusive, hall-rent-only sales tax", () => {
  it("does not add tax to what the customer pays", () => {
    // Rent 100,000 + catering 630,000. Tax is 16% of the RENT only and is
    // already inside that rent, so the customer still owes exactly 730,000.
    const result = calculateTotals({
      hallRent: toPaisa(100000),
      serviceLines: [{ qty: 350, rate: toPaisa(1800) }],
      extraLines: [],
      discountAmount: 0,
      taxes: [SALES_TAX],
    });

    expect(toRupees(result.subtotal)).toBe(730000);
    expect(toRupees(result.grandTotal)).toBe(730000); // tax NOT added
    expect(toRupees(result.taxableAmount)).toBe(100000); // rent only
    expect(toRupees(result.taxAmount)).toBe(16000); // 16% of rent
    expect(toRupees(result.netOfTax)).toBe(714000); // what the venue keeps
  });

  it("taxes the hall rent only — services and extras never enter the base", () => {
    const withoutExtras = calculateTotals({
      hallRent: toPaisa(100000),
      serviceLines: [],
      extraLines: [],
      discountAmount: 0,
      taxes: [SALES_TAX],
    });
    const withExtras = calculateTotals({
      hallRent: toPaisa(100000),
      serviceLines: [{ qty: 350, rate: toPaisa(1800) }],
      extraLines: [{ qty: 1, rate: toPaisa(25000) }],
      discountAmount: 0,
      taxes: [SALES_TAX],
    });

    // Same rent ⇒ same tax, no matter how much else is on the booking.
    expect(withExtras.taxAmount).toBe(withoutExtras.taxAmount);
    expect(toRupees(withExtras.taxAmount)).toBe(16000);
  });

  it("does not shrink the tax base when a discount is applied", () => {
    const result = calculateTotals({
      hallRent: toPaisa(100000),
      serviceLines: [{ qty: 1, rate: toPaisa(50000) }],
      extraLines: [],
      discountAmount: toPaisa(40000),
      taxes: [SALES_TAX],
    });

    expect(toRupees(result.subtotal)).toBe(150000);
    expect(toRupees(result.discount)).toBe(40000);
    expect(toRupees(result.grandTotal)).toBe(110000);
    // Tax still 16% of the full rent, unaffected by the discount.
    expect(toRupees(result.taxableAmount)).toBe(100000);
    expect(toRupees(result.taxAmount)).toBe(16000);
  });

  it("charges no tax when there is no hall rent", () => {
    const result = calculateTotals({
      hallRent: 0,
      serviceLines: [{ qty: 350, rate: toPaisa(1800) }],
      extraLines: [{ qty: 1, rate: toPaisa(25000) }],
      discountAmount: 0,
      taxes: [SALES_TAX],
    });

    expect(toRupees(result.subtotal)).toBe(655000);
    expect(result.taxableAmount).toBe(0);
    expect(result.taxAmount).toBe(0);
    expect(result.netOfTax).toBe(result.grandTotal);
  });

  it("keeps multiple taxes additive on the rent, never compounding", () => {
    const result = calculateTotals({
      hallRent: toPaisa(100000),
      serviceLines: [],
      extraLines: [],
      discountAmount: 0,
      taxes: [
        { id: "a", name: "Sales Tax", rateBps: 1600 },
        { id: "b", name: "Service Charge", rateBps: 500 },
      ],
    });

    // 21% of 100,000 = 21,000 — not 16% then 5% of the already-taxed figure.
    expect(toRupees(result.taxAmount)).toBe(21000);
    expect(toRupees(result.grandTotal)).toBe(100000); // still not added
    expect(toRupees(result.netOfTax)).toBe(79000);
  });

  it("caps the discount at the subtotal so the grand total never goes negative", () => {
    const result = calculateTotals({
      hallRent: 0,
      serviceLines: [{ qty: 1, rate: 1000 }],
      extraLines: [],
      discountAmount: 5000,
      taxes: [],
    });

    expect(result.discount).toBe(1000);
    expect(result.grandTotal).toBe(0);
  });

  it("handles a completely empty booking", () => {
    const result = calculateTotals({
      hallRent: 0,
      serviceLines: [],
      extraLines: [],
      discountAmount: 0,
      taxes: [SALES_TAX],
    });

    expect(result.subtotal).toBe(0);
    expect(result.taxableAmount).toBe(0);
    expect(result.taxAmount).toBe(0);
    expect(result.grandTotal).toBe(0);
    expect(result.netOfTax).toBe(0);
  });

  it("rounds tax to whole paisa", () => {
    // 1,234.57 rent at 16% = 197.5312 rupees ⇒ 19753 paisa
    const result = calculateTotals({
      hallRent: 123457,
      serviceLines: [],
      extraLines: [],
      discountAmount: 0,
      taxes: [SALES_TAX],
    });

    expect(result.taxAmount).toBe(19753);
    expect(Number.isInteger(result.taxAmount)).toBe(true);
  });
});

describe("numberToWords / amountInWords", () => {
  it("handles zero", () => {
    expect(numberToWords(0)).toBe("Zero");
  });

  it("handles the spec's own worked example (lakh, not million)", () => {
    // "Rs 957,000" -> "Nine Lakh Fifty-Seven Thousand Rupees Only" (spec §9.8/§20.12)
    expect(numberToWords(957000)).toBe("Nine Lakh Fifty-Seven Thousand");
    expect(amountInWords(toPaisa(957000))).toBe("Nine Lakh Fifty-Seven Thousand Rupees Only");
  });

  it("handles crore", () => {
    expect(numberToWords(12345678)).toBe(
      "One Crore Twenty-Three Lakh Forty-Five Thousand Six Hundred Seventy-Eight",
    );
  });

  it("handles teens and compound tens correctly", () => {
    expect(numberToWords(19)).toBe("Nineteen");
    expect(numberToWords(21)).toBe("Twenty-One");
    expect(numberToWords(100)).toBe("One Hundred");
    expect(numberToWords(101)).toBe("One Hundred One");
  });

  it("singularizes 'Rupee' for an amount of exactly one", () => {
    expect(amountInWords(toPaisa(1))).toBe("One Rupee Only");
  });

  it("appends a paisa remainder in words", () => {
    expect(amountInWords(toPaisa(1000) + 50)).toBe("One Thousand Rupees and Fifty Paisa Only");
  });

  it("handles a pure-paisa amount with zero rupees", () => {
    expect(amountInWords(25)).toBe("Zero Rupees and Twenty-Five Paisa Only");
  });
});
