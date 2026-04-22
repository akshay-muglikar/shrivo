import { useState } from "react"
import { useFieldArray, useForm } from "react-hook-form"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Check, ChevronsUpDown, Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
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
} from "@/components/ui/command"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"
import { currency } from "@/lib/formatters"
import { getBatches, getProducts } from "@/features/products/api/products.api"
import { createSupplierReturn } from "../api/purchase_orders.api"
import type { Supplier } from "../api/suppliers.api"

function fmtExpiry(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
}

function BatchSelector({
  productId,
  value,
  onChange,
}: {
  productId: string
  value: string
  onChange: (batchId: string) => void
}) {
  const { data: batches } = useQuery({
    queryKey: ["product-batches", productId],
    queryFn: () => getBatches(productId).then((r) => r.data),
    staleTime: 60_000,
    enabled: !!productId,
  })

  const active = (batches ?? []).filter((b) => b.quantity_remaining > 0)
  const selectedBatch = (batches ?? []).find((b) => b.id === value)
  if (active.length === 0) return null

  const selectedLabel = selectedBatch
    ? `${selectedBatch.batch_number ? `B:${selectedBatch.batch_number}` : "No batch"}${selectedBatch.expiry_date ? ` · ${fmtExpiry(selectedBatch.expiry_date)}` : ""}`
    : "Auto (FEFO)"

  return (
    <Select value={value || ""} onValueChange={onChange}>
      <SelectTrigger className="h-8 min-w-0 px-2 text-xs">
        <span className="truncate">{selectedLabel}</span>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="">Auto (FEFO)</SelectItem>
        {active.map((b) => (
          <SelectItem key={b.id} value={b.id}>
            {b.batch_number ? `Batch ${b.batch_number}` : "No batch no."}
            {b.expiry_date ? ` · Exp ${fmtExpiry(b.expiry_date)}` : ""}
            {` · ${b.quantity_remaining} left`}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

interface ReturnLineItem {
  product_id: string
  batch_id: string
  product_name: string
  quantity: string
  unit_cost: string
}

interface FormValues {
  supplier_credit_note_no: string
  notes: string
  items: ReturnLineItem[]
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  supplier: Supplier
}

export function CreateSupplierReturnSheet({ open, onOpenChange, supplier }: Props) {
  const qc = useQueryClient()
  const [comboOpen, setComboOpen] = useState<Record<string, boolean>>({})

  const { data: products = { items: [] }, isLoading: isProductsLoading } = useQuery({
    queryKey: ["invoice-products"],
    queryFn: () => getProducts({ limit: 500 }).then((r) => r.data),
    enabled: open,
  })

  const availableProducts = products.items.filter((p) => p.is_active)

  const { register, handleSubmit, setValue, watch, reset, control } = useForm<FormValues>({
    defaultValues: {
      supplier_credit_note_no: "",
      notes: "",
      items: [{ product_id: "", batch_id: "", product_name: "", quantity: "1", unit_cost: "0" }],
    },
  })

  const { fields, append, remove } = useFieldArray({ control, name: "items" })
  const watchedItems = watch("items")

  const total = watchedItems.reduce(
    (sum, item) => sum + (Number.parseFloat(item.unit_cost) || 0) * (Number.parseInt(item.quantity, 10) || 0),
    0
  )

  const mutation = useMutation({
    mutationFn: (values: FormValues) =>
      createSupplierReturn(supplier.id, {
        supplier_credit_note_no: values.supplier_credit_note_no.trim() || null,
        notes: values.notes.trim() || null,
        items: values.items.map((item) => ({
          product_id: item.product_id || null,
          batch_id: item.batch_id || null,
          product_name: item.product_name,
          quantity: Number.parseInt(item.quantity, 10),
          unit_cost: Number.parseFloat(item.unit_cost),
        })),
      }),
    onSuccess: () => {
      toast.success("Supplier return created")
      qc.invalidateQueries({ queryKey: ["supplier-returns", supplier.id] })
      qc.invalidateQueries({ queryKey: ["supplier", supplier.id] })
      qc.invalidateQueries({ queryKey: ["suppliers"] })
      qc.invalidateQueries({ queryKey: ["products"] })
      reset()
      setComboOpen({})
      onOpenChange(false)
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      toast.error(msg ?? "Failed to create supplier return")
    },
  })

  const hasIncomplete = watchedItems.some((item) => !item.product_name.trim())
  const hasInvalidQty = watchedItems.some((item) => (Number.parseInt(item.quantity, 10) || 0) <= 0)
  const hasInvalidCost = watchedItems.some((item) => (Number.parseFloat(item.unit_cost) || 0) <= 0)
  const isDisabled = mutation.isPending || hasIncomplete || hasInvalidQty || hasInvalidCost

  return (
    <Sheet open={open} onOpenChange={(value) => { if (!value) reset(); onOpenChange(value) }}>
      <SheetContent side="right" className="w-full max-w-none overflow-y-auto sm:!w-[min(64rem,55vw)]">
        <SheetHeader>
          <SheetTitle>New Supplier Return - {supplier.name}</SheetTitle>
        </SheetHeader>

        <form onSubmit={handleSubmit((values) => mutation.mutate(values))} className="flex flex-col gap-5 px-4 pb-6">
          <div className="text-xs text-muted-foreground">{availableProducts.length} products available</div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="credit-note">Supplier credit note no.</Label>
              <Input id="credit-note" placeholder="Optional" {...register("supplier_credit_note_no")} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="return-notes">Notes</Label>
              <Input id="return-notes" placeholder="Optional" {...register("notes")} />
            </div>
          </div>

          <Separator />

          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-semibold">Items</Label>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => append({ product_id: "", batch_id: "", product_name: "", quantity: "1", unit_cost: "0" })}
              >
                <Plus className="size-3.5" />
                Add item
              </Button>
            </div>

            {fields.map((field, idx) => {
              const selectedProduct = availableProducts.find((p) => p.id === watchedItems[idx]?.product_id)
              const qty = Number.parseInt(watchedItems[idx]?.quantity, 10) || 0
              const cost = Number.parseFloat(watchedItems[idx]?.unit_cost) || 0
              const lineTotal = qty * cost

              return (
                <div key={field.id} className="rounded-lg border bg-card p-3 flex flex-col gap-2.5">
                  <div className="space-y-2">
                    <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Product</div>
                    <Popover
                      open={!!comboOpen[field.id]}
                      onOpenChange={(value) => setComboOpen((current) => ({ ...current, [field.id]: value }))}
                    >
                      <PopoverTrigger
                        role="combobox"
                        className={cn(
                          "flex h-9 w-full items-center justify-between rounded-lg border border-input bg-background px-2.5 text-sm font-normal outline-none transition-colors hover:bg-muted",
                          !watchedItems[idx]?.product_id && "text-muted-foreground"
                        )}
                      >
                        <span className="truncate">
                          {selectedProduct?.name ?? (watchedItems[idx]?.product_name || "Select product...")}
                        </span>
                        <ChevronsUpDown className="ml-1 size-3.5 shrink-0 opacity-50" />
                      </PopoverTrigger>
                      <PopoverContent className="w-80 p-0" align="start">
                        <Command>
                          <CommandInput placeholder="Search by name or SKU..." />
                          <CommandList>
                            <CommandEmpty>{isProductsLoading ? "Loading..." : "No products found."}</CommandEmpty>
                            <CommandGroup>
                              {availableProducts.map((product) => (
                                <CommandItem
                                  key={product.id}
                                  value={`${product.name} ${product.sku}`}
                                  onSelect={() => {
                                    setValue(`items.${idx}.product_id`, product.id)
                                    setValue(`items.${idx}.batch_id`, "")
                                    setValue(`items.${idx}.product_name`, product.name)
                                    setValue(`items.${idx}.unit_cost`, product.cost_price)
                                    setComboOpen((current) => ({ ...current, [field.id]: false }))
                                  }}
                                >
                                  <div className="flex min-w-0 flex-1 flex-col">
                                    <span className="truncate font-medium">{product.name}</span>
                                    <span className="text-xs text-muted-foreground">
                                      {product.sku} - stock {product.current_stock} - cost {currency(product.cost_price)}
                                    </span>
                                  </div>
                                  <Check
                                    className={cn(
                                      "size-3.5 shrink-0 ml-2",
                                      watchedItems[idx]?.product_id === product.id ? "opacity-100" : "opacity-0"
                                    )}
                                  />
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>

                    <div className="grid grid-cols-[minmax(0,1fr)_72px_96px_32px] gap-2 items-start">
                      <div>
                        <div className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Batch</div>
                        <BatchSelector
                          productId={watchedItems[idx]?.product_id || ""}
                          value={watchedItems[idx]?.batch_id || ""}
                          onChange={(batchId) => setValue(`items.${idx}.batch_id`, batchId)}
                        />
                      </div>

                      <div>
                        <div className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Qty</div>
                        <Input type="number" min="1" className="h-9 text-sm" {...register(`items.${idx}.quantity`)} />
                      </div>

                      <div>
                        <div className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Unit cost</div>
                        <Input type="number" step="0.01" min="0" className="h-9 text-sm" {...register(`items.${idx}.unit_cost`)} />
                      </div>

                      <div className="pt-5">
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
                    </div>
                  </div>

                  {lineTotal > 0 && (
                    <div className="flex justify-end px-0.5">
                      <span className="text-xs text-muted-foreground">
                        Line total: <span className="font-medium text-foreground">{currency(lineTotal)}</span>
                      </span>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          <Separator />

          <div className="rounded-lg border bg-muted/30 p-4 flex justify-between text-sm font-semibold">
            <span>Total return value</span>
            <span>{currency(total)}</span>
          </div>

          <SheetFooter className="px-0">
            <Button type="submit" disabled={isDisabled} className="w-full" size="lg">
              {mutation.isPending ? "Creating..." : "Create Supplier Return"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}