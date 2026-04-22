import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
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
import { Switch } from "@/components/ui/switch"
import { createProduct, getCategories, getSuppliers, type Product, updateProduct } from "../api/products.api"
import { getInvoiceSettings } from "@/features/invoices/utils/invoiceSettings"

interface FormValues {
  name: string
  sku: string
  description: string
  category_id: string
  supplier_id: string
  unit_of_measure: string
  cost_price: string
  selling_price: string
  low_stock_threshold: string
  hsn_code: string
  gst_rate: string
  price_includes_gst: boolean
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  product?: Product | null
}

const DEFAULT_VALUES: FormValues = {
  name: "",
  sku: "",
  description: "",
  category_id: "",
  supplier_id: "",
  unit_of_measure: "piece",
  cost_price: "0",
  selling_price: "0",
  low_stock_threshold: "5",
  hsn_code: "",
  gst_rate: "0",
  price_includes_gst: false,
}

const UOM_OPTIONS = [
  { value: "piece", label: "Piece" },
  { value: "kg", label: "KG" },
  { value: "liter", label: "Liter" },
  { value: "box", label: "Box" },
  { value: "meter", label: "Meter" },
]

export function AddProductSheet({ open, onOpenChange, product }: Props) {
  const qc = useQueryClient()
  const gstEnabled = getInvoiceSettings().gstEnabled
  const isEdit = !!product

  const { data: categories = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: () => getCategories().then((r) => r.data),
    enabled: open,
  })

  const { data: suppliers = [] } = useQuery({
    queryKey: ["suppliers"],
    queryFn: () => getSuppliers({ limit: 500 }).then((r) => r.data.items),
    enabled: open,
  })

  const { register, handleSubmit, setValue, watch, reset, formState: { errors } } = useForm<FormValues>({
    defaultValues: DEFAULT_VALUES,
  })

  useEffect(() => {
    if (!open) return

    if (product) {
      reset({
        name: product.name,
        sku: product.sku,
        description: product.description ?? "",
        category_id: product.category?.id ?? "",
        supplier_id: product.supplier?.id ?? "",
        unit_of_measure: product.unit_of_measure,
        cost_price: product.cost_price,
        selling_price: product.selling_price,
        low_stock_threshold: String(product.low_stock_threshold),
        hsn_code: product.hsn_code ?? "",
        gst_rate: product.gst_rate,
        price_includes_gst: product.price_includes_gst,
      })
      return
    }

    reset(DEFAULT_VALUES)
  }, [open, product, reset])

  const mutation = useMutation({
    mutationFn: (values: FormValues) =>
      isEdit && product
        ? updateProduct(product.id, {
            name: values.name,
            sku: values.sku,
            description: values.description || null,
            category_id: values.category_id || null,
            supplier_id: values.supplier_id || null,
            unit_of_measure: values.unit_of_measure,
            cost_price: parseFloat(values.cost_price) || 0,
            selling_price: parseFloat(values.selling_price) || 0,
            low_stock_threshold: parseInt(values.low_stock_threshold) || 5,
            hsn_code: values.hsn_code.trim() || null,
            gst_rate: parseFloat(values.gst_rate) || 0,
            price_includes_gst: values.price_includes_gst,
          })
        : createProduct({
            name: values.name,
            sku: values.sku,
            description: values.description || null,
            category_id: values.category_id || null,
            supplier_id: values.supplier_id || null,
            unit_of_measure: values.unit_of_measure,
            cost_price: parseFloat(values.cost_price) || 0,
            selling_price: parseFloat(values.selling_price) || 0,
            low_stock_threshold: parseInt(values.low_stock_threshold) || 5,
            hsn_code: values.hsn_code.trim() || null,
            gst_rate: parseFloat(values.gst_rate) || 0,
            price_includes_gst: values.price_includes_gst,
          }),
    onSuccess: () => {
      toast.success(isEdit ? "Product updated" : "Product added")
      qc.invalidateQueries({ queryKey: ["products"] })
      reset(DEFAULT_VALUES)
      onOpenChange(false)
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      toast.error(msg ?? `Failed to ${isEdit ? "update" : "add"} product`)
    },
  })

  return (
    <Sheet
      open={open}
      onOpenChange={(nextOpen) => {
        onOpenChange(nextOpen)
        if (!nextOpen) reset(DEFAULT_VALUES)
      }}
    >
      <SheetContent
        side="right"
        className="w-full max-w-none overflow-y-auto border-l sm:!w-[min(56rem,50vw)]"
      >
        <SheetHeader>
          <SheetTitle>{isEdit ? "Edit Product" : "Add Product"}</SheetTitle>
        </SheetHeader>

        <form
          onSubmit={handleSubmit((v) => mutation.mutate(v))}
          className="flex flex-col gap-4 px-4 pb-4"
        >
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 flex flex-col gap-1.5">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                {...register("name", { required: true })}
                aria-invalid={!!errors.name}
                placeholder="e.g. Coca-Cola 500ml"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="sku">SKU *</Label>
              <Input
                id="sku"
                {...register("sku", { required: true })}
                aria-invalid={!!errors.sku}
                placeholder="e.g. CC-500"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>Unit</Label>
              <Select
                value={watch("unit_of_measure")}
                onValueChange={(v) => {
                  if (v) setValue("unit_of_measure", v)
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {UOM_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>Category</Label>
              <Select
                value={watch("category_id") ?? ""}
                onValueChange={(v) => {
                  if (v) setValue("category_id", v)
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>Supplier</Label>
              <Select
                value={watch("supplier_id") ?? ""}
                onValueChange={(v) => {
                  if (v) setValue("supplier_id", v)
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent>
                  {suppliers.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="cost_price">Cost Price</Label>
              <Input
                id="cost_price"
                type="number"
                step="0.01"
                min="0"
                {...register("cost_price")}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="selling_price">MRP / Selling Price</Label>
              <Input
                id="selling_price"
                type="number"
                step="0.01"
                min="0"
                {...register("selling_price")}
              />
            
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="low_stock_threshold">Low Stock Alert</Label>
              <Input
                id="low_stock_threshold"
                type="number"
                min="0"
                {...register("low_stock_threshold")}
              />
            </div>

            {gstEnabled && (
              <>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="hsn_code">HSN Code</Label>
                  <Input
                    id="hsn_code"
                    placeholder="e.g. 2202"
                    maxLength={8}
                    {...register("hsn_code")}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="gst_rate">GST Rate %</Label>
                  <Input
                    id="gst_rate"
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    placeholder="0"
                    {...register("gst_rate")}
                  />
                </div>
                <div className="col-span-2 flex items-center justify-between gap-3 rounded-lg border bg-muted/30 p-3">
                  <div>
                    <p className="text-sm font-medium">Price includes GST</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {watch("price_includes_gst")
                        ? "Selling price already includes GST — base price is backed out on invoices"
                        : "Selling price is before GST — GST is added on top on invoices"}
                    </p>
                  </div>
                  <Switch
                    checked={watch("price_includes_gst")}
                    onCheckedChange={(v) => setValue("price_includes_gst", v)}
                  />
                </div>
              </>
            )}

            <div className="col-span-2 flex flex-col gap-1.5">
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                {...register("description")}
                placeholder="Optional"
              />
            </div>
          </div>

          <SheetFooter className="px-0 pt-2">
            <Button type="submit" disabled={mutation.isPending} className="w-full">
              {mutation.isPending ? "Saving…" : isEdit ? "Update Product" : "Save Product"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}
