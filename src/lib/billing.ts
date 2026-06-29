import Decimal from "decimal.js";

export interface FlatBillingInput {
  flatId: number;
  waterTier: "Tam" | "Düşük" | "Yok";
}

export interface FlatInvoiceResult {
  flatId: number;
  gasFee: Decimal;
  waterFee: Decimal;
  otherFee: Decimal;
  totalDue: Decimal;
}

export interface DistributionResult {
  invoices: FlatInvoiceResult[];
  distributedGas: Decimal;
  distributedWater: Decimal;
  distributedDues: Decimal;
  totalRoundingDiff: Decimal;
}

function roundToNearest5(amount: Decimal): Decimal {
  // ROUND_HALF_EVEN (banker's rounding) matches C# Math.Round() default behaviour
  return amount.div(5).toDecimalPlaces(0, Decimal.ROUND_HALF_EVEN).mul(5);
}

export function distributeBills(
  flats: FlatBillingInput[],
  rawGasBill: string | null,
  rawWaterBill: string | null,
  rawDuesPlanned: string | null,
  lowDiscountPercent: number = 15,
): DistributionResult {
  const gas = rawGasBill ? new Decimal(rawGasBill) : new Decimal(0);
  const water = rawWaterBill ? new Decimal(rawWaterBill) : new Decimal(0);
  const dues = rawDuesPlanned ? new Decimal(rawDuesPlanned) : new Decimal(0);

  const n = flats.length;

  // Gas: always equal split across ALL flats (no seasonal/tier distinction)
  const gasFee = n > 0 ? roundToNearest5(gas.div(n)) : new Decimal(0);

  // Dues: equal split across all flats
  const duesFee = n > 0 ? roundToNearest5(dues.div(n)) : new Decimal(0);

  // Water: sequential method
  // 1. Base = totalWater / (Full + Low count)  [None pays 0]
  // 2. Low pays round5(base × (1 - discountPct/100))  [rounded first]
  // 3. Full pays round5((totalWater - lowCount × lowFee) / fullCount)
  const fullFlats = flats.filter((f) => f.waterTier === "Tam");
  const lowFlats = flats.filter((f) => f.waterTier === "Düşük");
  const occupied = fullFlats.length + lowFlats.length;
  const discountMul = new Decimal(1).sub(new Decimal(lowDiscountPercent).div(100));

  let lowWaterFee = new Decimal(0);
  let fullWaterFee = new Decimal(0);

  if (occupied > 0 && water.gt(0)) {
    const base = water.div(occupied);

    if (lowFlats.length > 0) {
      lowWaterFee = roundToNearest5(base.mul(discountMul));
    }

    if (fullFlats.length > 0) {
      const remaining = water.sub(lowWaterFee.mul(lowFlats.length));
      fullWaterFee = roundToNearest5(remaining.div(fullFlats.length));
    }
  }

  const invoices: FlatInvoiceResult[] = flats.map((flat) => {
    const waterFee =
      flat.waterTier === "Tam"
        ? fullWaterFee
        : flat.waterTier === "Düşük"
          ? lowWaterFee
          : new Decimal(0);
    const totalDue = gasFee.add(waterFee).add(duesFee);
    return { flatId: flat.flatId, gasFee, waterFee, otherFee: duesFee, totalDue };
  });

  const distributedGas = invoices.reduce((s, i) => s.add(i.gasFee), new Decimal(0));
  const distributedWater = invoices.reduce((s, i) => s.add(i.waterFee), new Decimal(0));
  const distributedDues = invoices.reduce((s, i) => s.add(i.otherFee), new Decimal(0));

  const totalRoundingDiff = distributedGas
    .sub(gas)
    .add(distributedWater.sub(water))
    .add(distributedDues.sub(dues));

  return {
    invoices,
    distributedGas,
    distributedWater,
    distributedDues,
    totalRoundingDiff,
  };
}
