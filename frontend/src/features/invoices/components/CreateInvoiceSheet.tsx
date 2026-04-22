import { useEffect, useRef, useState } from "react"
import { useForm, useFieldArray } from "react-hook-form"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Check, ChevronsUpDown, Plus, Trash2, UserPlus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command"
import { Separator } from "@/components/ui/separator"
import { Checkbox } from "@/components/ui/checkbox"
import { cn } from "@/lib/utils"
import { getProducts, getBatches } from "@/features/products/api/products.api"
import { createInvoice, getCustomers, type Invoice } from "../api/invoices.api"
import { getInvoiceSettings } from "../utils/invoiceSettings"
import { currency } from "@/lib/formatters"

const INDIAN_STATES: { code: string; name: string }[] = [
  { code: "JK", name: "Jammu & Kashmir" }, { code: "HP", name: "Himachal Pradesh" },
  { code: "PB", name: "Punjab" }, { code: "CH", name: "Chandigarh" },
  { code: "UT", name: "Uttarakhand" }, { code: "HR", name: "Haryana" },
  { code: "DL", name: "Delhi" }, { code: "RJ", name: "Rajasthan" },
  { code: "UP", name: "Uttar Pradesh" }, { code: "BR", name: "Bihar" },
  { code: "SK", name: "Sikkim" }, { code: "AR", name: "Arunachal Pradesh" },
  { code: "NL", name: "Nagaland" }, { code: "MN", name: "Manipur" },
  { code: "MI", name: "Mizoram" }, { code: "TR", name: "Tripura" },
  { code: "ML", name: "Meghalaya" }, { code: "AS", name: "Assam" },
  { code: "WB", name: "West Bengal" }, { code: "JH", name: "Jharkhand" },
  { code: "OD", name: "Odisha" }, { code: "CG", name: "Chhattisgarh" },
  { code: "MP", name: "Madhya Pradesh" }, { code: "GJ", name: "Gujarat" },
  { code: "MH", name: "Maharashtra" }, { code: "AP", name: "Andhra Pradesh" },
  { code: "KA", name: "Karnataka" }, { code: "GA", name: "Goa" },
  { code: "KL", name: "Kerala" }, { code: "TN", name: "Tamil Nadu" },
  { code: "TG", name: "Telangana" }, { code: "PY", name: "Puducherry" },
]

function fmtExpiry(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
}

function BatchSelector({
  productId,
  value,
  onChange,
}: {
  productId: string
  value: string
  onChange: (batchId: string | null) => void
}) {
  const { data: batches } = useQuery({
    queryKey: ["product-batches", productId],
    queryFn: () => getBatches(productId).then((r) => r.data),
    staleTime: 60_000,
    enabled: !!productId,
  })

  const active = (batches ?? []).filter((b) => b.quantity_remaining > 0)
  if (active.length === 0) return null

  return (
    <Select value={value || ""} onValueChange={onChange}>
      <SelectTrigger className="h-8 text-xs">
        <SelectValue placeholder="Auto (FEFO)" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="">Auto (FEFO)</SelectItem>
        {active.map((b) => {
          const isExpired = b.expiry_date ? new Date(b.expiry_date) < new Date() : false
          return (
            <SelectItem key={b.id} value={b.id}>
              <span className={isExpired ? "text-destructive" : ""}>
                {b.batch_number ? `Batch ${b.batch_number}` : "No batch no."}
                {b.expiry_date ? ` · Exp ${fmtExpiry(b.expiry_date)}` : ""}
                {" "}· {b.quantity_remaining} left
                {isExpired ? " ⚠" : ""}
              </span>
            </SelectItem>
          )
        })}
      </SelectContent>
    </Select>
  )
}

const WALK_IN_ID = "__walk_in__"

const PAYMENT_METHODS = [
  { value: "cash", label: "Cash" },
  { value: "upi", label: "UPI" },
  { value: "card", label: "Card" },
  { value: "credit", label: "Credit" },
]

interface LineItem {
  product_id: string
  batch_id: string   // "" = auto FEFO
  quantity: string
  unit_price: string
}

interface FormValues {
  customer_id: string
  walk_in_customer_name: string
  walk_in_customer_phone: string
  payment_method: string
  discount_type: "none" | "percent" | "flat"
  discount_value: string
  notes: string
  is_gst_invoice: boolean
  place_of_supply: string | null
  items: LineItem[]
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated?: (invoice: Invoice) => void
  quickAddRequest?: {
    requestId: number
    productId: string
    quantity: number
    batchId?: string | null
  } | null
}

export function CreateInvoiceSheet({ open, onOpenChange, onCreated, quickAddRequest }: Props) {
  const qc = useQueryClient()
  const [customerComboOpen, setCustomerComboOpen] = useState(false)
  const [comboOpen, setComboOpen] = useState<Record<string, boolean>>({})
  const lastQuickAddRequestRef = useRef(0)

  const { data: products = { items: [] }, isLoading: isProductsLoading } = useQuery({
    queryKey: ["invoice-products"],
    queryFn: () => getProducts({ limit: 500 }).then((r) => r.data),
    enabled: open,
  })

  const { data: customers = [], isLoading: isCustomersLoading } = useQuery({
    queryKey: ["invoice-customers"],
    queryFn: () => getCustomers({ limit: 500 }).then((r) => r.data.items),
    enabled: open,
  })

  const availableProducts = products.items.filter((p) => p.is_active)

  const gstEnabled = getInvoiceSettings().gstEnabled

  const { register, handleSubmit, setValue, watch, reset, control } = useForm<FormValues>({
    defaultValues: {
      customer_id: "",
      walk_in_customer_name: "",
      walk_in_customer_phone: "",
      payment_method: "cash",
      discount_type: "none",
      discount_value: "0",
      notes: "",
      is_gst_invoice: false,
      place_of_supply: getInvoiceSettings().shopState || "",
      items: [{ product_id: "", batch_id: "", quantity: "1", unit_price: "0" }],
    },
  })

  const { fields, append, remove } = useFieldArray({ control, name: "items" })
  const watchedItems = watch("items")
  const customerId = watch("customer_id")
  const isWalkIn = !customerId
  const discountType = watch("discount_type")
  const discountValue = parseFloat(watch("discount_value") || "0") || 0
  const isGstInvoice = watch("is_gst_invoice")
  const placeOfSupply = watch("place_of_supply")
  const shopState = getInvoiceSettings().shopState || ""
  const supplyType = (shopState && placeOfSupply && shopState.toUpperCase() !== placeOfSupply.toUpperCase()) ? "inter" : "intra"

  const subtotal = watchedItems.reduce(
    (sum, item) => sum + (parseFloat(item.unit_price) || 0) * (parseInt(item.quantity) || 0),
    0
  )
  const discountAmount =
    discountType === "percent" ? (subtotal * discountValue) / 100
    : discountType === "flat" ? Math.min(discountValue, subtotal)
    : 0
  const taxable = subtotal - discountAmount

  // Compute effective GST rate as weighted average of selected products' gst_rate
  const effectiveTaxRate = (() => {
    if (!gstEnabled || subtotal === 0) return 0
    let weighted = 0
    for (const item of watchedItems) {
      const product = availableProducts.find((p) => p.id === item.product_id)
      if (!product) continue
      const lineTotal = (parseInt(item.quantity) || 0) * (parseFloat(item.unit_price) || 0)
      weighted += (lineTotal / subtotal) * (parseFloat(product.gst_rate) || 0)
    }
    return weighted
  })()

  const taxAmount = (taxable * effectiveTaxRate) / 100
  const total = taxable + taxAmount

  const mutation = useMutation({
    mutationFn: (values: FormValues) =>
      createInvoice({
        customer_id: values.customer_id || null,
        walk_in_customer_name: values.customer_id ? null : values.walk_in_customer_name.trim() || null,
        walk_in_customer_phone: values.customer_id ? null : values.walk_in_customer_phone.trim() || null,
        discount_type: values.discount_type === "none" ? null : values.discount_type,
        discount_value: parseFloat(values.discount_value) || 0,
        payment_method: values.payment_method,
        tax_rate: effectiveTaxRate,
        notes: values.notes || null,
        is_gst_invoice: gstEnabled && values.is_gst_invoice,
        supply_type: supplyType,
        place_of_supply: values.place_of_supply || null,
        items: values.items.map((item) => ({
          product_id: item.product_id,
          batch_id: item.batch_id || null,
          quantity: parseInt(item.quantity),
          unit_price: parseFloat(item.unit_price),
        })),
      }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["invoices"] })
      qc.invalidateQueries({ queryKey: ["products"] })
      qc.invalidateQueries({ queryKey: ["invoice-products"] })
      reset()
      setComboOpen({})
      setCustomerComboOpen(false)
      onOpenChange(false)
      onCreated?.(res.data)
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      toast.error(msg ?? "Failed to create invoice")
    },
  })

  const hasIncomplete = watchedItems.some((i) => !i.product_id)
  const hasInvalidQty = watchedItems.some((item, idx) => {
    const qty = parseInt(item.quantity) || 0
    const p = products.items.find((p) => p.id === watchedItems[idx]?.product_id)
    return qty <= 0 || (p ? qty > p.current_stock : false)
  })
  const hasInvalidPrice = watchedItems.some((i) => (parseFloat(i.unit_price) || 0) <= 0)
  const missingWalkInInfo = isWalkIn && !watch("walk_in_customer_phone").trim() && !watch("walk_in_customer_name").trim()
  const isDisabled = mutation.isPending || hasIncomplete || hasInvalidQty || hasInvalidPrice || missingWalkInInfo

  const setCombo = (id: string, val: boolean) =>
    setComboOpen((cur) => ({ ...cur, [id]: val }))

  function getReferenceUnitPrice(product: (typeof availableProducts)[number]) {
    const gstR = parseFloat(product.gst_rate) || 0
    if (gstEnabled && product.price_includes_gst && gstR > 0) {
      return (parseFloat(product.selling_price) / (1 + gstR / 100)).toFixed(2)
    }
    return product.selling_price
  }

  function getDefaultUnitPrice(productId: string) {
    const product = availableProducts.find((p) => p.id === productId)
    if (!product) return "0"
    return getReferenceUnitPrice(product)
  }

  function quickAddProduct(productId: string, quantity: number, batchId?: string | null) {
    if (!productId || quantity <= 0) return
    const currentItems = watch("items")
    const normalizedBatchId = batchId || ""
    const existingIdx = currentItems.findIndex(
      (item) => item.product_id === productId && (item.batch_id || "") === normalizedBatchId
    )

    if (existingIdx >= 0) {
      const currentQty = parseInt(currentItems[existingIdx]?.quantity || "0") || 0
      setValue(`items.${existingIdx}.quantity`, String(currentQty + quantity))
      return
    }

    append({
      product_id: productId,
      batch_id: normalizedBatchId,
      quantity: String(quantity),
      unit_price: getDefaultUnitPrice(productId),
    })
  }

  useEffect(() => {
    if (!open || !quickAddRequest) return
    if (quickAddRequest.requestId === lastQuickAddRequestRef.current) return

    lastQuickAddRequestRef.current = quickAddRequest.requestId
    quickAddProduct(quickAddRequest.productId, quickAddRequest.quantity, quickAddRequest.batchId)
  }, [open, quickAddRequest])

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full max-w-none overflow-y-auto border-l sm:!w-[min(64rem,50vw)]"
      >
        <SheetHeader>
          <SheetTitle>New Invoice</SheetTitle>
        </SheetHeader>

        <form onSubmit={handleSubmit((v) => mutation.mutate(v))} className="flex flex-col gap-5 px-4 pb-6">

          {/* ── Customer ────────────────────────────────── */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label>Customer</Label>
              <Popover open={customerComboOpen} onOpenChange={setCustomerComboOpen}>
                <PopoverTrigger
                  role="combobox"
                  className="flex h-8 w-full items-center justify-between rounded-lg border border-input bg-background px-2.5 text-sm font-normal outline-none transition-colors hover:bg-muted"
                >
                  <span className="truncate">
                    {customerId
                      ? (customers.find((c) => c.id === customerId)?.name ?? "Selected")
                      : "Walk-in customer"}
                  </span>
                  <ChevronsUpDown className="ml-1 size-3.5 shrink-0 opacity-50" />
                </PopoverTrigger>
                <PopoverContent className="w-72 p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Search by name or mobile…" />
                    <CommandList>
                      <CommandEmpty>
                        {isCustomersLoading ? "Loading…" : "No customers found."}
                      </CommandEmpty>
                      <CommandGroup heading="New">
                        <CommandItem
                          value={WALK_IN_ID}
                          onSelect={() => {
                            setValue("customer_id", "")
                            setCustomerComboOpen(false)
                          }}
                        >
                          <UserPlus className="size-3.5 mr-2 text-muted-foreground" />
                          Walk-in customer
                          <Check
                            className={cn(
                              "size-3.5 ml-auto",
                              !customerId ? "opacity-100" : "opacity-0"
                            )}
                          />
                        </CommandItem>
                      </CommandGroup>
                      {customers.length > 0 && (
                        <>
                          <CommandSeparator />
                          <CommandGroup heading="Saved customers">
                            {customers.map((c) => (
                              <CommandItem
                                key={c.id}
                                value={`${c.name} ${c.phone ?? ""}`}
                                onSelect={() => {
                                  setValue("customer_id", c.id)
                                  setCustomerComboOpen(false)
                                }}
                              >
                                <div className="flex flex-col min-w-0 flex-1">
                                  <span className="truncate font-medium">{c.name}</span>
                                  {c.phone && (
                                    <span className="text-xs text-muted-foreground">{c.phone}</span>
                                  )}
                                </div>
                                <Check
                                  className={cn(
                                    "size-3.5 shrink-0 ml-2",
                                    customerId === c.id ? "opacity-100" : "opacity-0"
                                  )}
                                />
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </>
                      )}
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>Payment method</Label>
              <Select
                value={watch("payment_method")}
                onValueChange={(v) => {
                  if (v) setValue("payment_method", v)
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map((m) => (
                    <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Walk-in details — mobile is the unique key */}
          {isWalkIn && (
            <div className="grid grid-cols-2 gap-3 rounded-lg border bg-muted/30 p-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="walk_in_phone">Mobile *</Label>
                <Input
                  id="walk_in_phone"
                  placeholder="Phone number"
                  {...register("walk_in_customer_phone")}
                />
                <p className="text-[11px] text-muted-foreground">
                  Used to identify returning customers
                </p>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="walk_in_name">Name</Label>
                <Input
                  id="walk_in_name"
                  placeholder="Customer name"
                  {...register("walk_in_customer_name")}
                />
              </div>
            </div>
          )}

          <Separator />

          {/* ── Items ───────────────────────────────────── */}
          <div className="flex flex-col gap-3 min-w-0">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-semibold">Items</Label>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => append({ product_id: "", batch_id: "", quantity: "1", unit_price: "0" })}
              >
                <Plus className="size-3.5" />
                Add item
              </Button>
            </div>

            {fields.map((field, idx) => {
              const selectedProduct = availableProducts.find(
                (p) => p.id === watchedItems[idx]?.product_id
              )
              const qty = parseInt(watchedItems[idx]?.quantity) || 0
              const rate = parseFloat(watchedItems[idx]?.unit_price) || 0
              const discountReferencePrice = selectedProduct
                ? parseFloat(getReferenceUnitPrice(selectedProduct))
                : 0
              const discountPerUnit = Math.max(0, discountReferencePrice - rate)
              const lineTotal = qty * rate
              const overStock = selectedProduct && qty > selectedProduct.current_stock

              return (
                <div
                  key={field.id}
                  className="rounded-lg border bg-card p-3 flex flex-col gap-2"
                >
                  {/* Row 1: Product selector + Remove */}
                  <div className="flex gap-2 items-start">
                    <Popover
                      open={!!comboOpen[field.id]}
                      onOpenChange={(v) => setCombo(field.id, v)}
                    >
                      <PopoverTrigger
                        role="combobox"
                        className={cn(
                          "flex h-9 flex-1 items-center justify-between rounded-lg border border-input bg-background px-2.5 text-sm font-normal outline-none transition-colors hover:bg-muted",
                          !watchedItems[idx]?.product_id && "text-muted-foreground"
                        )}
                      >
                        <span className="truncate">
                          {selectedProduct?.name ?? "Select product…"}
                        </span>
                        <ChevronsUpDown className="ml-1 size-3.5 shrink-0 opacity-50" />
                      </PopoverTrigger>
                      <PopoverContent className="w-80 p-0" align="start">
                        <Command>
                          <CommandInput placeholder="Search by name or SKU…" />
                          <CommandList>
                            <CommandEmpty>
                              {isProductsLoading ? "Loading…" : "No products found."}
                            </CommandEmpty>
                            <CommandGroup>
                              {availableProducts.map((p) => (
                                <CommandItem
                                  key={p.id}
                                  value={`${p.name} ${p.sku}`}
                                  onSelect={() => {
                                    setValue(`items.${idx}.product_id`, p.id)
                                    setValue(`items.${idx}.batch_id`, "")
                                    const gstR = parseFloat(p.gst_rate) || 0
                                    const unitPrice = (gstEnabled && p.price_includes_gst && gstR > 0)
                                      ? (parseFloat(p.selling_price) / (1 + gstR / 100)).toFixed(2)
                                      : p.selling_price
                                    setValue(`items.${idx}.unit_price`, unitPrice)
                                    setCombo(field.id, false)
                                  }}
                                >
                                  <div className="flex flex-col min-w-0 flex-1">
                                    <span className="truncate font-medium">{p.name}</span>
                                    <span className="text-xs text-muted-foreground">
                                      {p.sku} · {p.current_stock} in stock · {currency(p.selling_price)}
                                      {gstEnabled && parseFloat(p.gst_rate) > 0 && (
                                        <span className="ml-1 text-amber-600 dark:text-amber-400">
                                          {p.price_includes_gst ? "(incl. GST)" : `+${p.gst_rate}% GST`}
                                        </span>
                                      )}
                                    </span>
                                  </div>
                                  <Check
                                    className={cn(
                                      "size-3.5 shrink-0 ml-2",
                                      watchedItems[idx]?.product_id === p.id
                                        ? "opacity-100"
                                        : "opacity-0"
                                    )}
                                  />
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>

                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-9 shrink-0 text-muted-foreground hover:text-destructive"
                      onClick={() => remove(idx)}
                      disabled={fields.length === 1}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>

                  {/* Row 2: Batch selector (only if product has batches) */}
                  {selectedProduct && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground w-14 shrink-0">Batch</span>
                      <div className="flex-1">
                        <BatchSelector
                          productId={selectedProduct.id}
                          value={watchedItems[idx]?.batch_id ?? ""}
                          onChange={(v) => setValue(`items.${idx}.batch_id`, v ?? "")}
                        />
                      </div>
                      {selectedProduct.hsn_code && (
                        <span className="text-xs text-muted-foreground shrink-0">
                          HSN: <span className="font-mono text-foreground">{selectedProduct.hsn_code}</span>
                        </span>
                      )}
                    </div>
                  )}

                  {/* Row 3: Qty | MRP | Invoice Disc/unit | Rate */}
                  <div className="grid grid-cols-4 gap-2 items-end">
                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Qty</span>
                      <Input
                        type="number"
                        min="1"
                        className="h-8 text-sm"
                        {...register(`items.${idx}.quantity`)}
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] text-muted-foreground uppercase tracking-wide">MRP</span>
                      <div className="h-8 flex items-center px-2.5 rounded-md border bg-muted/50 text-sm text-muted-foreground font-mono">
                        {selectedProduct ? currency(selectedProduct.selling_price) : "—"}
                      </div>
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Invoice Disc/unit</span>
                      <div className="h-8 flex items-center px-2.5 rounded-md border bg-muted/50 text-sm font-mono text-green-600">
                        {selectedProduct && discountPerUnit > 0 ? `−${currency(discountPerUnit)}` : "—"}
                      </div>
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Rate</span>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        className="h-8 text-sm"
                        {...register(`items.${idx}.unit_price`)}
                      />
                    </div>
                  </div>

                  {/* Row 4: stock warning + line total / GST */}
                  <div className="flex items-center justify-between px-0.5">
                    <div>
                      {overStock && (
                        <span className="text-xs text-destructive">
                          Only {selectedProduct.current_stock} in stock
                        </span>
                      )}
                    </div>
                    {selectedProduct && lineTotal > 0 && (() => {
                      const gstRate = parseFloat(selectedProduct.gst_rate) || 0
                      if (gstEnabled && gstRate > 0) {
                        const gstAmt = lineTotal * gstRate / 100
                        const half = gstAmt / 2
                        const halfRate = gstRate / 2
                        return (
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                            <span>{currency(lineTotal)}</span>
                            <span className="text-muted-foreground/40">+</span>
                            <span className="text-amber-600 dark:text-amber-400">
                              CGST {halfRate}% {currency(half)} · SGST {halfRate}% {currency(half)}
                            </span>
                            <span className="font-semibold text-foreground">= {currency(lineTotal + gstAmt)}</span>
                          </div>
                        )
                      }
                      return (
                        <span className="text-xs text-muted-foreground">
                          Total: <span className="font-medium text-foreground">{currency(lineTotal)}</span>
                        </span>
                      )
                    })()}
                  </div>
                </div>
              )
            })}
          </div>

          <Separator />

          {/* ── GST Invoice toggle ──────────────────────── */}
          {gstEnabled && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="is_gst_invoice"
                  checked={isGstInvoice}
                  onCheckedChange={(checked) => setValue("is_gst_invoice", !!checked)}
                />
                <Label htmlFor="is_gst_invoice" className="cursor-pointer">GST Invoice (TAX INVOICE)</Label>
              </div>
              {isGstInvoice && (
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="place_of_supply" className="text-xs text-muted-foreground">Place of Supply</Label>
                  <Select value={placeOfSupply} onValueChange={(v) => setValue("place_of_supply", v)}>
                    <SelectTrigger id="place_of_supply">
                      <SelectValue placeholder="Select state" />
                    </SelectTrigger>
                    <SelectContent>
                      {INDIAN_STATES.map((s) => (
                        <SelectItem key={s.code} value={s.code}>
                          {s.code} — {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {placeOfSupply && (
                    <p className="text-[11px] text-muted-foreground">
                      Supply type: <span className="font-medium">{supplyType === "inter" ? "Inter-state (IGST)" : "Intra-state (CGST + SGST)"}</span>
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── Discount & Notes ────────────────────────── */}
          <div className="flex flex-col gap-1.5">
            <Label>Discount</Label>
            <div className="flex gap-1.5">
              <Select
                value={discountType}
                onValueChange={(v) => setValue("discount_type", v as "none" | "percent" | "flat")}
              >
                <SelectTrigger className="w-24 shrink-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  <SelectItem value="percent">%</SelectItem>
                  <SelectItem value="flat">₹ flat</SelectItem>
                </SelectContent>
              </Select>
              {discountType !== "none" && (
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0"
                  {...register("discount_value")}
                  className="flex-1"
                />
              )}
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="notes">Notes</Label>
            <Input id="notes" placeholder="Optional" {...register("notes")} />
          </div>

          {/* ── Totals ──────────────────────────────────── */}
          <div className="rounded-lg border bg-muted/30 p-4 space-y-2 text-sm">
            <div className="flex justify-between text-muted-foreground">
              <span>Subtotal ({watchedItems.length} item{watchedItems.length !== 1 ? "s" : ""})</span>
              <span>{currency(subtotal)}</span>
            </div>
            {discountAmount > 0 && (
              <div className="flex justify-between text-green-600">
                <span>
                  Discount{discountType === "percent" ? ` (${discountValue}%)` : ""}
                </span>
                <span>−{currency(discountAmount)}</span>
              </div>
            )}
            {taxAmount > 0 && (
              gstEnabled && isGstInvoice ? (
                supplyType === "inter" ? (
                  <div className="flex justify-between text-muted-foreground">
                    <span>IGST ({effectiveTaxRate.toFixed(2)}%)</span>
                    <span>{currency(taxAmount)}</span>
                  </div>
                ) : (
                  <>
                    <div className="flex justify-between text-muted-foreground">
                      <span>CGST ({(effectiveTaxRate / 2).toFixed(2)}%)</span>
                      <span>{currency(taxAmount / 2)}</span>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>SGST ({(effectiveTaxRate / 2).toFixed(2)}%)</span>
                      <span>{currency(taxAmount / 2)}</span>
                    </div>
                  </>
                )
              ) : gstEnabled ? (
                <>
                  <div className="flex justify-between text-muted-foreground">
                    <span>CGST ({(effectiveTaxRate / 2).toFixed(2)}%)</span>
                    <span>{currency(taxAmount / 2)}</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>SGST ({(effectiveTaxRate / 2).toFixed(2)}%)</span>
                    <span>{currency(taxAmount / 2)}</span>
                  </div>
                </>
              ) : (
                <div className="flex justify-between text-muted-foreground">
                  <span>Tax ({effectiveTaxRate.toFixed(2)}%)</span>
                  <span>{currency(taxAmount)}</span>
                </div>
              )
            )}
            <Separator />
            <div className="flex justify-between font-semibold text-base">
              <span>Total</span>
              <span>{currency(total)}</span>
            </div>
          </div>

          <SheetFooter className="px-0">
            <Button type="submit" disabled={isDisabled} className="w-full" size="lg">
              {mutation.isPending ? "Creating…" : "Create Invoice"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>

    </Sheet>
  )
}
