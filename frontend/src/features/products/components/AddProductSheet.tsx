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
import { createProduct, getCategories, getSuppliers } from "../api/products.api"

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
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const UOM_OPTIONS = [
  { value: "piece", label: "Piece" },
  { value: "kg", label: "KG" },
  { value: "liter", label: "Liter" },
  { value: "box", label: "Box" },
  { value: "meter", label: "Meter" },
]

export function AddProductSheet({ open, onOpenChange }: Props) {
  const qc = useQueryClient()

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
    defaultValues: {
      unit_of_measure: "piece",
      cost_price: "0",
      selling_price: "0",
      low_stock_threshold: "5",
    },
  })

  const mutation = useMutation({
    mutationFn: (values: FormValues) =>
      createProduct({
        name: values.name,
        sku: values.sku,
        description: values.description || null,
        category_id: values.category_id || null,
        supplier_id: values.supplier_id || null,
        unit_of_measure: values.unit_of_measure,
        cost_price: parseFloat(values.cost_price) || 0,
        selling_price: parseFloat(values.selling_price) || 0,
        low_stock_threshold: parseInt(values.low_stock_threshold) || 5,
      }),
    onSuccess: () => {
      toast.success("Product added")
      qc.invalidateQueries({ queryKey: ["products"] })
      reset()
      onOpenChange(false)
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      toast.error(msg ?? "Failed to add product")
    },
  })

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full max-w-none overflow-y-auto border-l sm:!w-[min(56rem,50vw)]"
      >
        <SheetHeader>
          <SheetTitle>Add Product</SheetTitle>
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
              <Label htmlFor="selling_price">Selling Price</Label>
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
              {mutation.isPending ? "Saving…" : "Save Product"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}
