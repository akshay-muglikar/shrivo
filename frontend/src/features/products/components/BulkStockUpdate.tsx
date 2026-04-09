import { useRef, useState, useEffect } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { ScanBarcode, CheckCircle2, XCircle, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { getProducts, stockIn, type Product } from "../api/products.api"
import { currency } from "@/lib/formatters"

interface ScanEntry {
  id: string
  productName: string
  sku: string
  qty: number
  ok: boolean
  message: string
}

export function BulkStockUpdate() {
  const qc = useQueryClient()
  const barcodeRef = useRef<HTMLInputElement>(null)
  const qtyRef = useRef<HTMLInputElement>(null)

  const [barcode, setBarcode] = useState("")
  const [qty, setQty] = useState("1")
  const [matched, setMatched] = useState<Product | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [log, setLog] = useState<ScanEntry[]>([])

  // Auto-focus barcode input on mount
  useEffect(() => {
    barcodeRef.current?.focus()
  }, [])

  const stockInMutation = useMutation({
    mutationFn: ({ id, quantity }: { id: string; quantity: number }) =>
      stockIn(id, quantity),
    onSuccess: (_, vars) => {
      const entry: ScanEntry = {
        id: crypto.randomUUID(),
        productName: matched!.name,
        sku: matched!.sku,
        qty: vars.quantity,
        ok: true,
        message: `+${vars.quantity} added`,
      }
      setLog((prev) => [entry, ...prev])
      qc.invalidateQueries({ queryKey: ["products"] })
      // Reset for next scan
      setMatched(null)
      setBarcode("")
      setQty("1")
      setTimeout(() => barcodeRef.current?.focus(), 50)
    },
    onError: () => {
      const entry: ScanEntry = {
        id: crypto.randomUUID(),
        productName: matched?.name ?? barcode,
        sku: matched?.sku ?? barcode,
        qty: Number(qty),
        ok: false,
        message: "Stock update failed",
      }
      setLog((prev) => [entry, ...prev])
      toast.error("Failed to update stock")
    },
  })

  async function handleBarcodeScan(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== "Enter") return
    e.preventDefault()
    if (!barcode.trim()) return

    setNotFound(false)
    setMatched(null)

    try {
      const res = await getProducts({ search: barcode.trim(), limit: 5 })
      const product = res.data.items.find(
        (p) => p.sku.toLowerCase() === barcode.trim().toLowerCase()
      )
      if (product) {
        setMatched(product)
        setTimeout(() => {
          qtyRef.current?.focus()
          qtyRef.current?.select()
        }, 50)
      } else {
        setNotFound(true)
        toast.error(`No product found for SKU: ${barcode}`)
      }
    } catch {
      toast.error("Search failed")
    }
  }

  function handleConfirm(e: React.FormEvent) {
    e.preventDefault()
    if (!matched) return
    const quantity = parseInt(qty)
    if (!quantity || quantity <= 0) {
      toast.error("Enter a valid quantity")
      return
    }
    stockInMutation.mutate({ id: matched.id, quantity })
  }

  function handleQtyKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      setMatched(null)
      setBarcode("")
      setQty("1")
      setTimeout(() => barcodeRef.current?.focus(), 50)
    }
  }

  return (
    <div className="p-6 space-y-4 max-w-xl">
      <div className="flex items-center gap-2">
        <ScanBarcode className="size-5 text-muted-foreground" />
        <h3 className="font-medium">Bulk Stock Update</h3>
      </div>
      <p className="text-sm text-muted-foreground">
        Scan or type a barcode/SKU and press <kbd className="bg-muted px-1 rounded text-xs">Enter</kbd> to look up the product.
      </p>

      {/* Barcode Input */}
      <div className="flex gap-2">
        <Input
          ref={barcodeRef}
          placeholder="Scan or type SKU…"
          value={barcode}
          onChange={(e) => {
            setBarcode(e.target.value)
            setNotFound(false)
            if (matched) setMatched(null)
          }}
          onKeyDown={handleBarcodeScan}
          aria-invalid={notFound}
          className="font-mono"
          disabled={stockInMutation.isPending}
        />
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setBarcode("")
            setMatched(null)
            setNotFound(false)
            barcodeRef.current?.focus()
          }}
          disabled={!barcode && !matched}
        >
          Clear
        </Button>
      </div>

      {/* Matched Product */}
      {matched && (
        <form onSubmit={handleConfirm}>
          <Card className="border-green-200 bg-green-50 dark:bg-green-950/20 dark:border-green-900">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-medium">{matched.name}</p>
                  <p className="text-xs text-muted-foreground font-mono">{matched.sku}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm">{currency(matched.selling_price)}</p>
                  <p className="text-xs text-muted-foreground">Stock: {matched.current_stock}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium shrink-0">Qty to add:</label>
                <Input
                  ref={qtyRef}
                  type="number"
                  min="1"
                  value={qty}
                  onChange={(e) => setQty(e.target.value)}
                  onKeyDown={handleQtyKeyDown}
                  className="w-24 text-center font-mono"
                  disabled={stockInMutation.isPending}
                />
                <Button
                  type="submit"
                  size="sm"
                  disabled={stockInMutation.isPending}
                  className="flex-1"
                >
                  {stockInMutation.isPending ? "Updating…" : "Confirm (Enter)"}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setMatched(null)
                    setBarcode("")
                    setQty("1")
                    barcodeRef.current?.focus()
                  }}
                >
                  Skip
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">Press <kbd className="bg-muted px-1 rounded">Esc</kbd> to cancel</p>
            </CardContent>
          </Card>
        </form>
      )}

      {/* Session Log */}
      {log.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Session log ({log.length})
            </p>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setLog([])}
              className="h-6 px-2 text-xs text-muted-foreground"
            >
              <Trash2 className="size-3 mr-1" />
              Clear
            </Button>
          </div>
          <div className="space-y-1.5 max-h-64 overflow-y-auto">
            {log.map((entry) => (
              <div
                key={entry.id}
                className="flex items-center gap-2 rounded-md border bg-card px-3 py-2 text-sm"
              >
                {entry.ok ? (
                  <CheckCircle2 className="size-4 text-green-500 shrink-0" />
                ) : (
                  <XCircle className="size-4 text-destructive shrink-0" />
                )}
                <span className="flex-1 font-medium truncate">{entry.productName}</span>
                <span className="font-mono text-xs text-muted-foreground">{entry.sku}</span>
                <Badge variant={entry.ok ? "secondary" : "destructive"} className="shrink-0">
                  {entry.ok ? `+${entry.qty}` : "error"}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
