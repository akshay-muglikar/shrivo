import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { PackagePlus, AlertTriangle } from "lucide-react"
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
import { Badge } from "@/components/ui/badge"
import { stockIn, getBatches, type Product, type StockInPayload } from "../api/products.api"

interface FormValues {
  quantity: number
  batch_number: string
  expiry_date: string
  cost_price: string
  notes: string
}

interface Props {
  product: Product | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

function expiryStatus(dateStr: string | null): "expired" | "soon" | "ok" | null {
  if (!dateStr) return null
  const expiry = new Date(dateStr)
  const now = new Date()
  const days = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  if (days < 0) return "expired"
  if (days <= 30) return "soon"
  return "ok"
}

function ExpiryBadge({ date }: { date: string | null }) {
  const status = expiryStatus(date)
  if (!status || status === "ok") return null
  return (
    <Badge variant={status === "expired" ? "destructive" : "outline"} className={
      status === "soon" ? "border-amber-400 text-amber-700 bg-amber-50" : ""
    }>
      {status === "expired" ? "Expired" : "Expiring soon"}
    </Badge>
  )
}

export function StockInSheet({ product, open, onOpenChange }: Props) {
  const qc = useQueryClient()

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormValues>({
    defaultValues: { quantity: 1, batch_number: "", expiry_date: "", cost_price: "", notes: "" },
  })

  useEffect(() => {
    if (open) reset({ quantity: 1, batch_number: "", expiry_date: "", cost_price: "", notes: "" })
  }, [open, reset])

  const { data: batches } = useQuery({
    queryKey: ["product-batches", product?.id],
    queryFn: () => getBatches(product!.id).then((r) => r.data),
    enabled: !!product && open,
  })

  const mutation = useMutation({
    mutationFn: (payload: StockInPayload) => stockIn(product!.id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["products"] })
      qc.invalidateQueries({ queryKey: ["product-batches", product?.id] })
      toast.success("Stock updated")
      onOpenChange(false)
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.detail ?? "Failed to update stock")
    },
  })

  function onSubmit(values: FormValues) {
    const payload: StockInPayload = {
      quantity: Number(values.quantity),
      notes: values.notes || undefined,
      batch_number: values.batch_number || undefined,
      expiry_date: values.expiry_date || undefined,
      cost_price: values.cost_price ? Number(values.cost_price) : undefined,
    }
    mutation.mutate(payload)
  }

  const activeBatches = batches?.filter((b) => b.quantity_remaining > 0) ?? []

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full max-w-none overflow-y-auto sm:!w-[min(36rem,50vw)]">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <PackagePlus className="size-4" />
            Stock In — {product?.name}
          </SheetTitle>
        </SheetHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5 px-4 pb-4 pt-2">

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="quantity" className="text-xs">Quantity *</Label>
            <Input
              id="quantity"
              type="number"
              min={1}
              {...register("quantity", { required: true, min: 1, valueAsNumber: true })}
              aria-invalid={!!errors.quantity}
            />
          </div>

          <div className="rounded-lg border border-dashed border-border p-4 space-y-4 bg-muted/30">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Batch Info (optional)</p>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="batch_number" className="text-xs">Batch Number</Label>
              <Input
                id="batch_number"
                placeholder="e.g. BX-20241"
                {...register("batch_number")}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="expiry_date" className="text-xs">Expiry Date</Label>
              <Input
                id="expiry_date"
                type="date"
                {...register("expiry_date")}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cost_price" className="text-xs">Cost Price (₹)</Label>
            <Input
              id="cost_price"
              type="number"
              step="0.01"
              min={0}
              placeholder={product?.cost_price ?? ""}
              {...register("cost_price")}
            />
            <p className="text-[11px] text-muted-foreground">Leave blank to keep current cost price.</p>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="notes" className="text-xs">Notes</Label>
            <Input id="notes" placeholder="e.g. From distributor invoice #123" {...register("notes")} />
          </div>

          <SheetFooter className="px-0">
            <Button type="submit" disabled={mutation.isPending} className="w-full">
              {mutation.isPending ? "Adding…" : "Add Stock"}
            </Button>
          </SheetFooter>
        </form>

        {/* Existing batches */}
        {activeBatches.length > 0 && (
          <div className="px-4 pb-6 space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Active Batches</p>
            <div className="space-y-2">
              {activeBatches.map((b) => {
                const status = expiryStatus(b.expiry_date)
                return (
                  <div
                    key={b.id}
                    className={`rounded-lg border p-3 text-sm flex items-start justify-between gap-3 ${
                      status === "expired" ? "border-red-200 bg-red-50" :
                      status === "soon" ? "border-amber-200 bg-amber-50" :
                      "border-border bg-muted/20"
                    }`}
                  >
                    <div className="space-y-0.5">
                      <div className="font-medium flex items-center gap-2">
                        {b.batch_number ?? <span className="text-muted-foreground italic">No batch number</span>}
                        <ExpiryBadge date={b.expiry_date} />
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {b.expiry_date
                          ? `Expires ${new Date(b.expiry_date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}`
                          : "No expiry date"
                        }
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-semibold">{b.quantity_remaining}</div>
                      <div className="text-[11px] text-muted-foreground">units left</div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {batches && activeBatches.length === 0 && batches.length > 0 && (
          <div className="px-4 pb-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground rounded-lg border border-border p-3">
              <AlertTriangle className="size-4 text-amber-500 shrink-0" />
              All batches exhausted — add new stock above.
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}
