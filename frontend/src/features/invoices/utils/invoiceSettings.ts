export type InvoiceTemplate = "classic" | "modern" | "minimal"
export type InvoiceSize = "A4" | "A5" | "Letter" | "80mm" | "58mm"

export interface InvoiceSettings {
  template: InvoiceTemplate
  size: InvoiceSize
  shopName: string
  shopTagline: string
  shopAddress: string
  shopPhone: string
  shopEmail: string
}

const STORAGE_KEY = "invoice_settings"

const DEFAULTS: InvoiceSettings = {
  template: "classic",
  size: "A4",
  shopName: "Shop Manager",
  shopTagline: "Inventory & Billing",
  shopAddress: "",
  shopPhone: "",
  shopEmail: "",
}

export function getInvoiceSettings(): InvoiceSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULTS
    return { ...DEFAULTS, ...JSON.parse(raw) }
  } catch {
    return DEFAULTS
  }
}

export function saveInvoiceSettings(s: Partial<InvoiceSettings>) {
  const current = getInvoiceSettings()
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...current, ...s }))
}

export const TEMPLATE_LABELS: Record<InvoiceTemplate, string> = {
  classic: "Classic",
  modern: "Modern",
  minimal: "Minimal",
}

export const SIZE_LABELS: Record<InvoiceSize, string> = {
  A4: "A4 (210 × 297 mm)",
  A5: "A5 (148 × 210 mm)",
  Letter: "Letter (216 × 279 mm)",
  "80mm": "Thermal 80 mm",
  "58mm": "Thermal 58 mm",
}

export const THERMAL_SIZES: InvoiceSize[] = ["80mm", "58mm"]
export function isThermal(size: InvoiceSize) { return THERMAL_SIZES.includes(size) }
