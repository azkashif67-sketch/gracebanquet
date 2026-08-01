export interface ServiceLineUI {
  serviceId: string;
  serviceName: string;
  category: string;
  pricingType: "fixed" | "per_head" | "per_hour" | "per_unit";
  qty: number;
  ratePaisa: number;
  taxable: boolean;
}

export interface MenuLineUI {
  itemName: string;
  type: string;
  checked: boolean;
}

export interface ExtraLineUI {
  label: string;
  qty: number;
  ratePaisa: number;
  taxable: boolean;
}

export interface InstallmentRowUI {
  label: string;
  amountRupees: string;
  dueDate: string;
}

export type { ActiveService as AvailableService } from "@/lib/db/queries/services";

export interface AvailableTax {
  id: string;
  name: string;
  rate: number; // basis points
  isDefault: number;
}
