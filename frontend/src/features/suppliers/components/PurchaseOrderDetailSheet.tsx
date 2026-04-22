import { useQuery } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { currency, date } from "@/lib/formatters"
import { getPurchaseOrder } from "../api/purchase_orders.api"

const statusVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  received: "default",
  ordered: "secondary",
  draft: "outline",
  cancelled: "destructive",
}

interface Props {
  poId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onReceiveGRN?: (poId: string) => void
  onCancelPO?: (poId: string) => void
  isCancelling?: boolean
}

export function PurchaseOrderDetailSheet({
  poId,
  open,
  onOpenChange,
  onReceiveGRN,
  onCancelPO,
  isCancelling = false,
}: Props) {
  const { data: po, isLoading } = useQuery({
    queryKey: ["purchase-order", poId],
    queryFn: () => getPurchaseOrder(poId!).then((r) => r.data),
    enabled: open && !!poId,
  })

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full max-w-none overflow-y-auto sm:!w-[min(64rem,58vw)]">
        <SheetHeader>
          <SheetTitle>{po ? `Purchase Order ${po.po_number}` : "Purchase Order Details"}</SheetTitle>
        </SheetHeader>

        <div className="space-y-4 px-4 pb-6">
          {isLoading && <p className="text-sm text-muted-foreground">Loading purchase order details...</p>}

          {!isLoading && !po && <p className="text-sm text-muted-foreground">Purchase order not found.</p>}

          {po && (
            <>
              <Card>
                <CardContent className="grid gap-4 p-4 sm:grid-cols-3">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Supplier</p>
                    <p className="mt-1 font-medium">{po.supplier.name}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Status</p>
                    <div className="mt-1">
                      <Badge variant={statusVariant[po.status] ?? "secondary"} className="capitalize">
                        {po.status}
                      </Badge>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Total</p>
                    <p className="mt-1 font-semibold">{currency(po.total_amount)}</p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="grid gap-4 p-4 sm:grid-cols-3">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Ordered Qty</p>
                    <p className="mt-1 text-lg font-semibold">{po.items.reduce((sum, item) => sum + item.quantity, 0)}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Received Qty</p>
                    <p className="mt-1 text-lg font-semibold">{po.items.reduce((sum, item) => sum + (item.received_quantity ?? 0), 0)}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Pending Qty</p>
                    <p className="mt-1 text-lg font-semibold">
                      {po.items.reduce((sum, item) => sum + Math.max(item.quantity - (item.received_quantity ?? 0), 0), 0)}
                    </p>
                  </div>
                </CardContent>
              </Card>

              {(po.status === "draft" || po.status === "ordered") && (
                <Card>
                  <CardContent className="flex flex-wrap items-center gap-2 p-4">
                    <p className="mr-2 text-sm text-muted-foreground">Quick actions</p>
                    <Button
                      size="sm"
                      onClick={() => onReceiveGRN?.(po.id)}
                    >
                      Receive GRN
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onCancelPO?.(po.id)}
                      disabled={isCancelling}
                    >
                      {isCancelling ? "Cancelling..." : "Cancel PO"}
                    </Button>
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardContent className="grid gap-4 p-4 sm:grid-cols-2">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Created</p>
                    <p className="mt-1 text-sm">{date(po.created_at)}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Received</p>
                    <p className="mt-1 text-sm">{po.received_at ? date(po.received_at) : "-"}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Supplier invoice no.</p>
                    <p className="mt-1 text-sm">{po.supplier_invoice_no ?? "-"}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Notes</p>
                    <p className="mt-1 text-sm">{po.notes ?? "-"}</p>
                  </div>
                </CardContent>
              </Card>

              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead>Ordered</TableHead>
                      <TableHead>Received</TableHead>
                      <TableHead>Batch</TableHead>
                      <TableHead>Expiry</TableHead>
                      <TableHead>Unit Cost</TableHead>
                      <TableHead>Line Total</TableHead>
                      <TableHead>Line Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {po.items.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>
                          <div className="font-medium">{item.product_name}</div>
                        </TableCell>
                        <TableCell>{item.quantity}</TableCell>
                        <TableCell>{item.received_quantity ?? "-"}</TableCell>
                        <TableCell>{item.batch_number ?? "-"}</TableCell>
                        <TableCell>{item.expiry_date ? date(item.expiry_date) : "-"}</TableCell>
                        <TableCell>{currency(item.unit_cost)}</TableCell>
                        <TableCell>{currency(item.line_total)}</TableCell>
                        <TableCell>
                          {(item.received_quantity ?? 0) >= item.quantity ? (
                            <Badge variant="default">Received</Badge>
                          ) : (item.received_quantity ?? 0) > 0 ? (
                            <Badge variant="secondary">Partially received</Badge>
                          ) : (
                            <Badge variant="outline">Pending</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}