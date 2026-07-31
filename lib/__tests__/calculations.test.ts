import { describe, expect, it } from "vitest";
import { calculateTotals, formatPKR, toPaisa, toRupees } from "../calculations";

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

describe("calculateTotals", () => {
  it("computes a simple single-tax booking with no discount", () => {
    const result = calculateTotals({
      serviceLines: [{ qty: 350, rate: toPaisa(1800), taxable: true }],
      extraLines: [],
      discountAmount: 0,
      taxes: [{ id: "t1", name: "Punjab Sales Tax", rateBps: 1600 }],
      taxOnDiscounted: false,
    });

    expect(result.subtotal).toBe(63000000);
    expect(result.discount).toBe(0);
    expect(result.taxableAmount).toBe(63000000);
    expect(result.taxLines).toEqual([
      { id: "t1", name: "Punjab Sales Tax", rateBps: 1600, amount: 10080000 },
    ]);
    expect(result.taxAmount).toBe(10080000);
    expect(result.grandTotal).toBe(73080000);
  });

  it("matches the worked example from the spec (multi-tax, discount, extras)", () => {
    // Spec §9.8 sample invoice: subtotal 865,000; discount 40,000;
    // taxable 825,000; Punjab Sales Tax 16% = 132,000; Service Charge 5% = 41,250;
    // grand total 998,250. All lines taxable, tax charged on the discounted base.
    const result = calculateTotals({
      serviceLines: [
        { qty: 350, rate: toPaisa(1800), taxable: true }, // 630,000
        { qty: 1, rate: toPaisa(45000), taxable: true }, // 45,000
        { qty: 1, rate: toPaisa(65000), taxable: true }, // 65,000
        { qty: 1, rate: toPaisa(85000), taxable: true }, // 85,000
      ],
      extraLines: [
        { qty: 1, rate: toPaisa(25000), taxable: true },
        { qty: 1, rate: toPaisa(15000), taxable: true },
      ],
      discountAmount: toPaisa(40000),
      taxes: [
        { id: "sales", name: "Punjab Sales Tax", rateBps: 1600 },
        { id: "service", name: "Service Charge", rateBps: 500 },
      ],
      taxOnDiscounted: true,
    });

    expect(toRupees(result.subtotal)).toBe(865000);
    expect(toRupees(result.discount)).toBe(40000);
    expect(toRupees(result.taxableAmount)).toBe(825000);
    expect(toRupees(result.taxLines.find((t) => t.id === "sales")!.amount)).toBe(132000);
    expect(toRupees(result.taxLines.find((t) => t.id === "service")!.amount)).toBe(41250);
    expect(toRupees(result.taxAmount)).toBe(173250);
    expect(toRupees(result.grandTotal)).toBe(998250);
  });

  it("does not compound multiple taxes — both compute on the same taxable base", () => {
    const result = calculateTotals({
      serviceLines: [{ qty: 1, rate: 10000, taxable: true }],
      extraLines: [],
      discountAmount: 0,
      taxes: [
        { id: "a", name: "Tax A", rateBps: 1600 },
        { id: "b", name: "Tax B", rateBps: 500 },
      ],
      taxOnDiscounted: false,
    });

    // 21% of 10,000 = 2,100 — not 16% then 5% of the already-taxed total (2,110.4...)
    expect(result.taxAmount).toBe(2100);
    expect(result.grandTotal).toBe(12100);
  });

  it("only taxes the taxable proportion of a mixed taxable/non-taxable subtotal", () => {
    const result = calculateTotals({
      serviceLines: [
        { qty: 1, rate: 60000, taxable: true },
        { qty: 1, rate: 40000, taxable: false },
      ],
      extraLines: [],
      discountAmount: 0,
      taxes: [{ id: "t1", name: "Tax", rateBps: 1000 }], // 10%
      taxOnDiscounted: false,
    });

    expect(result.subtotal).toBe(100000);
    // 60% of the subtotal is taxable
    expect(result.taxableAmount).toBe(60000);
    expect(result.taxAmount).toBe(6000);
    expect(result.grandTotal).toBe(106000);
  });

  it("caps the discount at the subtotal so grand total never goes negative", () => {
    const result = calculateTotals({
      serviceLines: [{ qty: 1, rate: 1000, taxable: false }],
      extraLines: [],
      discountAmount: 5000,
      taxes: [],
      taxOnDiscounted: true,
    });

    expect(result.discount).toBe(1000);
    expect(result.grandTotal).toBe(0);
  });

  it("handles a zero-subtotal booking without dividing by zero", () => {
    const result = calculateTotals({
      serviceLines: [],
      extraLines: [],
      discountAmount: 0,
      taxes: [{ id: "t1", name: "Tax", rateBps: 1600 }],
      taxOnDiscounted: false,
    });

    expect(result.subtotal).toBe(0);
    expect(result.taxableAmount).toBe(0);
    expect(result.taxAmount).toBe(0);
    expect(result.grandTotal).toBe(0);
  });
});
