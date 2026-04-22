import { useEffect, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { currency } from "@/lib/formatters"
import {
  getPurchaseOrder,
  receivePurchaseOrder,
  type PurchaseOrder,
  type ReceivePOItemInput,
} from "../api/purchase_orders.api"

interface ReceiveItemForm {
  received_quantity: string
  batch_number: string
  expiry_date: string
}

interface Props {
  poId: string | null
  supplierId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

function buildInitialItemState(po: PurchaseOrder) {
  return Object.fromEntries(
    po.items.map((item) => [
      item.id,
      {
        received_quantity: String(item.received_quantity ?? item.quantity),
        batch_number: item.batch_number ?? "",
        expiry_date: item.expiry_date ?? "",
      },
    ])
  ) as Record<string, ReceiveItemForm>
}

export function ReceivePODialog({ poId, supplierId, open, onOpenChange }: Props) {
  const qc = useQueryClient()
  const { data: po, isLoading } = useQuery({
    queryKey: ["purchase-order", poId],
    queryFn: () => getPurchaseOrder(poId!).then((r) => r.data),
    enabled: open && !!poId,
  })

  const [supplierInvoiceNo, setSupplierInvoiceNo] = useState("")
  const [items, setItems] = useState<Record<string, ReceiveItemForm>>({})

  useEffect(() => {
    if (!po || !open) return
    setSupplierInvoiceNo(po.supplier_invoice_no ?? "")
    setItems(buildInitialItemState(po))
  }, [po, open])

  const receiveMutation = useMutation({
    mutationFn: (payload: { id: string; supplier_invoice_no: string | null; items: ReceivePOItemInput[] }) =>
      receivePurchaseOrder(payload.id, {
        supplier_invoice_no: payload.supplier_invoice_no,
        items: payload.items,
      }),
    onSuccess: () => {
      toast.success("Goods received and stock updated")
      qc.invalidateQueries({ queryKey: ["purchase-orders"] })
      qc.invalidateQueries({ queryKey: ["purchase-order", poId] })
      qc.invalidateQueries({ queryKey: ["supplier", supplierId] })
      qc.invalidateQueries({ queryKey: ["suppliers"] })
      qc.invalidateQueries({ queryKey: ["products"] })
      onOpenChange(false)
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      toast.error(msg ?? "Failed to receive purchase order")
    },
  })

  function updateItem(itemId: string, patch: Partial<ReceiveItemForm>) {
    setItems((current) => ({
      ...current,
      [itemId]: {
        ...current[itemId],
        ...patch,
      },
    }))
  }

  function handleSubmit() {
    if (!po) return

    const payloadItems: ReceivePOItemInput[] = []
    for (const item of po.items) {
      const formItem = items[item.id]
      const receivedQuantity = Number.parseInt(formItem?.received_quantity ?? "", 10)
      if (!Number.isFinite(receivedQuantity) || receivedQuantity <= 0) {
        toast.error(`Enter a valid received quantity for ${item.product_name}`)
        return
      }
      if (receivedQuantity > item.quantity) {
        toast.error(`Received quantity cannot exceed ordered quantity for ${item.product_name}`)
        return
      }

      payloadItems.push({
        po_item_id: item.id,
        received_quantity: receivedQuantity,
        batch_number: formItem?.batch_number.trim() || null,
        expiry_date: formItem?.expiry_date || null,
      })
    }

    receiveMutation.mutate({
      id: po.id,
      supplier_invoice_no: supplierInvoiceNo.trim() || null,
      items: payloadItems,
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl p-0">
        <DialogHeader className="px-4 pt-4">
          <DialogTitle>{po ? `Receive ${po.po_number}` : "Receive purchase order"}</DialogTitle>
          <DialogDescription>
            Add the supplier invoice number and received batch details before posting stock into inventory.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[75vh] overflow-y-auto px-4 pb-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="supplier-invoice-no">Supplier invoice no.</Label>
              <Input
                id="supplier-invoice-no"
                placeholder="Optional"
                value={supplierInvoiceNo}
                onChange={(e) => setSupplierInvoiceNo(e.target.value)}
                disabled={isLoading || receiveMutation.isPending}
              />
            </div>
            {po && (
              <div className="rounded-lg border bg-muted/30 px-3 py-2 text-sm">
                <p className="text-muted-foreground">Total</p>
                <p className="mt-1 font-semibold">{currency(po.total_amount)}</p>
              </div>
            )}
          </div>

          <Separator className="my-4" />

          <div className="space-y-3">
            {isLoading && <p className="text-sm text-muted-foreground">Loading purchase order…</p>}

            {!isLoading && po?.items.map((item, index) => {
              const formItem = items[item.id]
              return (
                <div key={item.id} className="rounded-xl border p-3 space-y-3">
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-sm font-semibold">{index + 1}. {item.product_name}</p>
                      <p className="text-xs text-muted-foreground">
                        Ordered {item.quantity} units at {currency(item.unit_cost)} each
                      </p>
                    </div>
                    {!item.product_id && (
                      <p className="text-xs text-amber-600">No linked product. Stock will not be updated.</p>
                    )}
                  </div>

                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor={`qty-${item.id}`}>Received qty</Label>
                      <Input
                        id={`qty-${item.id}`}
                        type="number"
                        min="1"
                        max={item.quantity}
                        value={formItem?.received_quantity ?? ""}
                        onChange={(e) => updateItem(item.id, { received_quantity: e.target.value })}
                        disabled={receiveMutation.isPending}
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor={`batch-${item.id}`}>Batch no.</Label>
                      <Input
                        id={`batch-${item.id}`}
                        placeholder="Optional"
                        value={formItem?.batch_number ?? ""}
                        onChange={(e) => updateItem(item.id, { batch_number: e.target.value })}
                        disabled={receiveMutation.isPending}
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor={`expiry-${item.id}`}>Expiry date</Label>
                      <Input
                        id={`expiry-${item.id}`}
                        type="date"
                        value={formItem?.expiry_date ?? ""}
                        onChange={(e) => updateItem(item.id, { expiry_date: e.target.value })}
                        disabled={receiveMutation.isPending}
                      />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={receiveMutation.isPending}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isLoading || receiveMutation.isPending || !po}>
            {receiveMutation.isPending ? "Receiving…" : "Receive stock"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}