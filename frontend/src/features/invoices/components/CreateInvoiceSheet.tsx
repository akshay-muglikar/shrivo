import { useState } from "react"
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
import { cn } from "@/lib/utils"
import { getProducts } from "@/features/products/api/products.api"
import { createInvoice, getCustomers } from "../api/invoices.api"
import { currency } from "@/lib/formatters"

const WALK_IN_ID = "__walk_in__"

const PAYMENT_METHODS = [
  { value: "cash", label: "Cash" },
  { value: "upi", label: "UPI" },
  { value: "card", label: "Card" },
  { value: "credit", label: "Credit" },
]

interface LineItem {
  product_id: string
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
  tax_rate: string
  notes: string
  items: LineItem[]
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function CreateInvoiceSheet({ open, onOpenChange }: Props) {
  const qc = useQueryClient()
  const [customerComboOpen, setCustomerComboOpen] = useState(false)
  const [comboOpen, setComboOpen] = useState<Record<string, boolean>>({})

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

  const { register, handleSubmit, setValue, watch, reset, control } = useForm<FormValues>({
    defaultValues: {
      customer_id: "",
      walk_in_customer_name: "",
      walk_in_customer_phone: "",
      payment_method: "cash",
      discount_type: "none",
      discount_value: "0",
      tax_rate: "0",
      notes: "",
      items: [{ product_id: "", quantity: "1", unit_price: "0" }],
    },
  })

  const { fields, append, remove } = useFieldArray({ control, name: "items" })
  const watchedItems = watch("items")
  const customerId = watch("customer_id")
  const isWalkIn = !customerId
  const taxRate = parseFloat(watch("tax_rate") || "0") || 0
  const discountType = watch("discount_type")
  const discountValue = parseFloat(watch("discount_value") || "0") || 0

  const subtotal = watchedItems.reduce(
    (sum, item) => sum + (parseFloat(item.unit_price) || 0) * (parseInt(item.quantity) || 0),
    0
  )
  const discountAmount =
    discountType === "percent" ? (subtotal * discountValue) / 100
    : discountType === "flat" ? Math.min(discountValue, subtotal)
    : 0
  const taxable = subtotal - discountAmount
  const taxAmount = (taxable * taxRate) / 100
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
        tax_rate: parseFloat(values.tax_rate) || 0,
        notes: values.notes || null,
        items: values.items.map((item) => ({
          product_id: item.product_id,
          quantity: parseInt(item.quantity),
          unit_price: parseFloat(item.unit_price),
        })),
      }),
    onSuccess: () => {
      toast.success("Invoice created")
      qc.invalidateQueries({ queryKey: ["invoices"] })
      qc.invalidateQueries({ queryKey: ["products"] })
      qc.invalidateQueries({ queryKey: ["invoice-products"] })
      reset()
      setComboOpen({})
      setCustomerComboOpen(false)
      onOpenChange(false)
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
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-semibold">Items</Label>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => append({ product_id: "", quantity: "1", unit_price: "0" })}
              >
                <Plus className="size-3.5" />
                Add item
              </Button>
            </div>

            {/* Column headers */}
            <div className="grid grid-cols-[1fr_80px_100px_32px] gap-2 px-1">
              <span className="text-xs text-muted-foreground font-medium">Product</span>
              <span className="text-xs text-muted-foreground font-medium">Qty</span>
              <span className="text-xs text-muted-foreground font-medium">Unit price</span>
              <span />
            </div>

            {fields.map((field, idx) => {
              const selectedProduct = availableProducts.find(
                (p) => p.id === watchedItems[idx]?.product_id
              )
              const qty = parseInt(watchedItems[idx]?.quantity) || 0
              const price = parseFloat(watchedItems[idx]?.unit_price) || 0
              const lineTotal = qty * price
              const overStock = selectedProduct && qty > selectedProduct.current_stock

              return (
                <div
                  key={field.id}
                  className="rounded-lg border bg-card p-3 flex flex-col gap-2.5"
                >
                  <div className="grid grid-cols-[1fr_80px_100px_32px] gap-2 items-start">
                    {/* Product combobox */}
                    <Popover
                      open={!!comboOpen[field.id]}
                      onOpenChange={(v) => setCombo(field.id, v)}
                    >
                      <PopoverTrigger
                        role="combobox"
                        className={cn(
                          "flex h-9 w-full items-center justify-between rounded-lg border border-input bg-background px-2.5 text-sm font-normal outline-none transition-colors hover:bg-muted",
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
                                    setValue(`items.${idx}.unit_price`, p.selling_price)
                                    setCombo(field.id, false)
                                  }}
                                >
                                  <div className="flex flex-col min-w-0 flex-1">
                                    <span className="truncate font-medium">{p.name}</span>
                                    <span className="text-xs text-muted-foreground">
                                      {p.sku} · {p.current_stock} in stock · {currency(p.selling_price)}
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

                    {/* Qty */}
                    <Input
                      type="number"
                      min="1"
                      className="h-9 text-sm"
                      {...register(`items.${idx}.quantity`)}
                    />

                    {/* Unit price */}
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      className="h-9 text-sm"
                      {...register(`items.${idx}.unit_price`)}
                    />

                    {/* Remove */}
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-9 text-muted-foreground hover:text-destructive"
                      onClick={() => remove(idx)}
                      disabled={fields.length === 1}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>

                  {/* Row footer: stock warning + line total */}
                  <div className="flex items-center justify-between px-0.5">
                    <div>
                      {overStock && (
                        <span className="text-xs text-destructive">
                          Only {selectedProduct.current_stock} in stock
                        </span>
                      )}
                    </div>
                    {selectedProduct && lineTotal > 0 && (
                      <span className="text-xs text-muted-foreground">
                        Line total: <span className="font-medium text-foreground">{currency(lineTotal)}</span>
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          <Separator />

          {/* ── Discount, Tax & Notes ───────────────────── */}
          <div className="grid grid-cols-2 gap-3">
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
              <Label htmlFor="tax_rate">Tax %</Label>
              <Input
                id="tax_rate"
                type="number"
                step="0.01"
                min="0"
                max="100"
                placeholder="0"
                {...register("tax_rate")}
              />
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
            {taxRate > 0 && (
              <div className="flex justify-between text-muted-foreground">
                <span>Tax ({taxRate}%)</span>
                <span>{currency(taxAmount)}</span>
              </div>
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
