import { useState } from "react"
import { useForm, useFieldArray } from "react-hook-form"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Check, ChevronsUpDown, Plus, Trash2 } from "lucide-react"
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
} from "@/components/ui/command"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"
import { currency } from "@/lib/formatters"
import { getProducts } from "@/features/products/api/products.api"
import { createPurchaseOrder } from "../api/purchase_orders.api"
import type { Supplier } from "../api/suppliers.api"

interface LineItem {
  product_id: string
  product_name: string
  quantity: string
  unit_cost: string
}

interface FormValues {
  status: string
  notes: string
  items: LineItem[]
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  supplier: Supplier
}

export function CreatePOSheet({ open, onOpenChange, supplier }: Props) {
  const qc = useQueryClient()
  const [comboOpen, setComboOpen] = useState<Record<string, boolean>>({})

  const { data: products = { items: [] }, isLoading: isProductsLoading } = useQuery({
    queryKey: ["po-products"],
    queryFn: () => getProducts({ limit: 500 }).then((r) => r.data),
    enabled: open,
  })

  const activeProducts = products.items.filter((p) => p.is_active)

  const { register, handleSubmit, setValue, watch, reset, control } = useForm<FormValues>({
    defaultValues: {
      status: "ordered",
      notes: "",
      items: [{ product_id: "", product_name: "", quantity: "1", unit_cost: "0" }],
    },
  })

  const { fields, append, remove } = useFieldArray({ control, name: "items" })
  const watchedItems = watch("items")

  const total = watchedItems.reduce(
    (sum, item) => sum + (parseFloat(item.unit_cost) || 0) * (parseInt(item.quantity) || 0),
    0
  )

  const mutation = useMutation({
    mutationFn: (values: FormValues) =>
      createPurchaseOrder({
        supplier_id: supplier.id,
        status: values.status,
        notes: values.notes.trim() || null,
        items: values.items.map((item) => ({
          product_id: item.product_id || null,
          product_name: item.product_name,
          quantity: parseInt(item.quantity),
          unit_cost: parseFloat(item.unit_cost),
        })),
      }),
    onSuccess: () => {
      toast.success("Purchase order created")
      qc.invalidateQueries({ queryKey: ["purchase-orders"] })
      qc.invalidateQueries({ queryKey: ["suppliers"] })
      reset()
      setComboOpen({})
      onOpenChange(false)
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      toast.error(msg ?? "Failed to create purchase order")
    },
  })

  const setCombo = (id: string, val: boolean) =>
    setComboOpen((cur) => ({ ...cur, [id]: val }))

  const hasIncomplete = watchedItems.some((i) => !i.product_name.trim())
  const hasInvalidQty = watchedItems.some((i) => (parseInt(i.quantity) || 0) <= 0)
  const hasInvalidCost = watchedItems.some((i) => (parseFloat(i.unit_cost) || 0) <= 0)
  const isDisabled = mutation.isPending || hasIncomplete || hasInvalidQty || hasInvalidCost

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v) }}>
      <SheetContent side="right" className="w-full max-w-none overflow-y-auto sm:!w-[min(64rem,55vw)]">
        <SheetHeader>
          <SheetTitle>New Purchase Order — {supplier.name}</SheetTitle>
        </SheetHeader>

        <form onSubmit={handleSubmit((v) => mutation.mutate(v))} className="flex flex-col gap-5 px-4 pb-6">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label>Status</Label>
              <Select
                value={watch("status")}
                onValueChange={(v) => {
                  if (!v) return
                  setValue("status", v)
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="ordered">Ordered</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="po-notes">Notes</Label>
              <Input id="po-notes" placeholder="Optional" {...register("notes")} />
            </div>
          </div>

          <Separator />

          {/* Items */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-semibold">Items</Label>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => append({ product_id: "", product_name: "", quantity: "1", unit_cost: "0" })}
              >
                <Plus className="size-3.5" />
                Add item
              </Button>
            </div>

            <div className="grid grid-cols-[1fr_80px_110px_32px] gap-2 px-1">
              <span className="text-xs text-muted-foreground font-medium">Product</span>
              <span className="text-xs text-muted-foreground font-medium">Qty</span>
              <span className="text-xs text-muted-foreground font-medium">Unit cost</span>
              <span />
            </div>

            {fields.map((field, idx) => {
              const selectedProduct = activeProducts.find(
                (p) => p.id === watchedItems[idx]?.product_id
              )
              const qty = parseInt(watchedItems[idx]?.quantity) || 0
              const cost = parseFloat(watchedItems[idx]?.unit_cost) || 0
              const lineTotal = qty * cost

              return (
                <div key={field.id} className="rounded-lg border bg-card p-3 flex flex-col gap-2.5">
                  <div className="grid grid-cols-[1fr_80px_110px_32px] gap-2 items-start">
                    {/* Product combobox */}
                    <Popover open={!!comboOpen[field.id]} onOpenChange={(v) => setCombo(field.id, v)}>
                      <PopoverTrigger
                        role="combobox"
                        className={cn(
                          "flex h-9 w-full items-center justify-between rounded-lg border border-input bg-background px-2.5 text-sm font-normal outline-none transition-colors hover:bg-muted",
                          !watchedItems[idx]?.product_id && "text-muted-foreground"
                        )}
                      >
                        <span className="truncate">
                          {selectedProduct?.name ?? (watchedItems[idx]?.product_name || "Select product…")}
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
                              {activeProducts.map((p) => (
                                <CommandItem
                                  key={p.id}
                                  value={`${p.name} ${p.sku}`}
                                  onSelect={() => {
                                    setValue(`items.${idx}.product_id`, p.id)
                                    setValue(`items.${idx}.product_name`, p.name)
                                    setValue(`items.${idx}.unit_cost`, p.cost_price)
                                    setCombo(field.id, false)
                                  }}
                                >
                                  <div className="flex flex-col min-w-0 flex-1">
                                    <span className="truncate font-medium">{p.name}</span>
                                    <span className="text-xs text-muted-foreground">
                                      {p.sku} · cost {currency(p.cost_price)}
                                    </span>
                                  </div>
                                  <Check
                                    className={cn(
                                      "size-3.5 shrink-0 ml-2",
                                      watchedItems[idx]?.product_id === p.id ? "opacity-100" : "opacity-0"
                                    )}
                                  />
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>

                    <Input type="number" min="1" className="h-9 text-sm" {...register(`items.${idx}.quantity`)} />
                    <Input type="number" step="0.01" min="0" className="h-9 text-sm" {...register(`items.${idx}.unit_cost`)} />

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
            <span>Total</span>
            <span>{currency(total)}</span>
          </div>

          <SheetFooter className="px-0">
            <Button type="submit" disabled={isDisabled} className="w-full" size="lg">
              {mutation.isPending ? "Creating…" : "Create Purchase Order"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}
