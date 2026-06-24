// ─── Shared LineItem type ────────────────────────────────────────────────────
// Used by both QuotationPage and BookingsPage
// BookingRepository re-exports this as `BookingLineItem` for backward compat

export interface LineItem {
  id?: string;
  name: string;
  desc?: string;
  qty: number;
  rate: number;
  amount: number;
}

// Preset shapes
export interface LineItemPreset {
  name: string;
  desc?: string;
  rate?: number; // Booking presets include rate; Quotation presets do not
}

export interface ChipGroup {
  label: string;
  chipClass?: string; // optional extra CSS class for the chips in this group
  names: string[];
}
