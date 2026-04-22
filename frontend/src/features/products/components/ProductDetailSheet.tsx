import { useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import { AlertTriangle, Boxes, CalendarClock, Package2, Tag } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { currency } from "@/lib/formatters"
import { getInvoiceSettings } from "@/features/invoices/utils/invoiceSettings"
import { getBatches, type Product, type ProductBatch } from "../api/products.api"
import { StockBadge } from "./StockBadge"

interface Props {
  product: Product | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

function expiryStatus(expiryDate: string | null) {
  if (!expiryDate) return "ok"

  const now = new Date()
  const expiry = new Date(expiryDate)
  if (expiry < now) return "expired"

  const days = Math.ceil((expiry.getTime() - now.getTime()) / 86400000)
  if (days <= 30) return "soon"
  return "ok"
}

function expiryLabel(expiryDate: string | null) {
  if (!expiryDate) return "No expiry date"
  return new Date(expiryDate).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
}

function SellingPriceDetail({ product }: { product: Product }) {
  const { gstEnabled } = getInvoiceSettings()
  const gstRate = Number.parseFloat(product.gst_rate) || 0
  const price = Number.parseFloat(product.selling_price) || 0

  if (!gstEnabled || gstRate === 0) {
    return <span className="font-medium">{currency(price)}</span>
  }

  if (product.price_includes_gst) {
    const base = price / (1 + gstRate / 100)
    return (
      <div className="space-y-1">
        <div className="font-medium">{currency(price)}</div>
        <div className="text-xs text-muted-foreground">
          GST included · base {currency(base)}
        </div>
      </div>
    )
  }

  const withGst = price * (1 + gstRate / 100)
  return (
    <div className="space-y-1">
      <div className="font-medium">{currency(price)}</div>
      <div className="text-xs text-muted-foreground">With GST {currency(withGst)}</div>
    </div>
  )
}

function BatchCard({ batch }: { batch: ProductBatch }) {
  const status = expiryStatus(batch.expiry_date)
  const batchClasses =
    status === "expired"
      ? "border-red-200 bg-red-50"
      : status === "soon"
        ? "border-amber-200 bg-amber-50"
        : "border-border bg-muted/20"

  return (
    <div className={`rounded-lg border p-3 ${batchClasses}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="font-medium">
              {batch.batch_number ?? <span className="italic text-muted-foreground">No batch number</span>}
            </span>
            {status === "expired" && <Badge variant="destructive">Expired</Badge>}
            {status === "soon" && <Badge variant="outline" className="border-amber-400 bg-amber-50 text-amber-700">Expiring soon</Badge>}
          </div>
          <div className="text-xs text-muted-foreground">Expiry: {expiryLabel(batch.expiry_date)}</div>
          {batch.cost_price && (
            <div className="text-xs text-muted-foreground">Cost: {currency(batch.cost_price)}</div>
          )}
        </div>
        <div className="text-right shrink-0">
          <div className="text-lg font-semibold">{batch.quantity_remaining}</div>
          <div className="text-xs text-muted-foreground">available</div>
        </div>
      </div>
    </div>
  )
}

export function ProductDetailSheet({ product, open, onOpenChange }: Props) {
  const { data: batches = [], isLoading } = useQuery({
    queryKey: ["product-batches", product?.id],
    queryFn: () => getBatches(product!.id).then((response) => response.data),
    enabled: !!product?.id && open,
  })

  const activeBatches = useMemo(
    () => batches.filter((batch) => batch.quantity_remaining > 0),
    [batches]
  )
  const exhaustedBatches = useMemo(
    () => batches.filter((batch) => batch.quantity_remaining <= 0),
    [batches]
  )

  if (!product) return null

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full max-w-none overflow-y-auto sm:!w-[min(54rem,56vw)]">
        <SheetHeader>
          <SheetTitle>{product.name}</SheetTitle>
        </SheetHeader>

        <div className="space-y-5 px-4 pb-6">
          <Card>
            <CardContent className="grid gap-4 p-4 sm:grid-cols-3">
              <div className="space-y-1">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">Available stock</div>
                <div><StockBadge current={product.current_stock} threshold={product.low_stock_threshold} /></div>
              </div>
              <div className="space-y-1">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">Active batches</div>
                <div className="text-lg font-semibold">{activeBatches.length}</div>
              </div>
              <div className="space-y-1">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">Reorder level</div>
                <div className="text-lg font-semibold">{product.low_stock_threshold}</div>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4 sm:grid-cols-2">
            <Card>
              <CardContent className="space-y-3 p-4">
                <div className="flex items-center gap-2 text-sm font-medium"><Package2 className="size-4" /> Product details</div>
                <div className="grid gap-3 text-sm sm:grid-cols-2">
                  <div>
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">SKU</div>
                    <div className="font-medium font-mono">{product.sku}</div>
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">Unit</div>
                    <div className="font-medium capitalize">{product.unit_of_measure}</div>
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">Category</div>
                    <div className="font-medium">{product.category?.name ?? "-"}</div>
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">Supplier</div>
                    <div className="font-medium">{product.supplier?.name ?? "-"}</div>
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">HSN code</div>
                    <div className="font-medium">{product.hsn_code ?? "-"}</div>
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">GST</div>
                    <div className="font-medium">{Number.parseFloat(product.gst_rate) || 0}%</div>
                  </div>
                </div>
                {product.description && (
                  <>
                    <Separator />
                    <div>
                      <div className="text-xs uppercase tracking-wide text-muted-foreground">Description</div>
                      <div className="mt-1 text-sm text-muted-foreground">{product.description}</div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardContent className="space-y-3 p-4">
                <div className="flex items-center gap-2 text-sm font-medium"><Tag className="size-4" /> Pricing</div>
                <div className="grid gap-3 text-sm sm:grid-cols-2">
                  <div>
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">Cost price</div>
                    <div className="font-medium">{currency(product.cost_price)}</div>
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">MRP / Selling price</div>
                    <SellingPriceDetail product={product} />
                  </div>
                </div>
                
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardContent className="space-y-4 p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-sm font-medium"><Boxes className="size-4" /> Available stock by batch</div>
                <div className="text-xs text-muted-foreground">{product.current_stock} units total</div>
              </div>

              {isLoading && <div className="text-sm text-muted-foreground">Loading batches...</div>}

              {!isLoading && activeBatches.length === 0 && (
                <div className="flex items-center gap-2 rounded-lg border p-3 text-sm text-muted-foreground">
                  <AlertTriangle className="size-4 text-amber-500 shrink-0" />
                  No available batches for this product.
                </div>
              )}

              {!isLoading && activeBatches.length > 0 && (
                <div className="space-y-2">
                  {activeBatches.map((batch) => (
                    <BatchCard key={batch.id} batch={batch} />
                  ))}
                </div>
              )}

              {!isLoading && exhaustedBatches.length > 0 && (
                <div className="space-y-2 pt-2">
                  <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
                    <CalendarClock className="size-3.5" />
                    Past or exhausted batches
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {exhaustedBatches.length} batch{exhaustedBatches.length === 1 ? "" : "es"} with zero available stock.
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </SheetContent>
    </Sheet>
  )
}