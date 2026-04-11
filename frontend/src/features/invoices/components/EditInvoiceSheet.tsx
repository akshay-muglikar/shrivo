import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Download, Printer } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { type Invoice, updateInvoice } from "../api/invoices.api"
import { printInvoice, downloadInvoicePdf } from "../utils/printInvoice"
import { WhatsAppShareButton } from "./WhatsAppShareButton"
import { currency, date } from "@/lib/formatters"

const PAYMENT_METHODS = [
  { value: "cash", label: "Cash" },
  { value: "upi", label: "UPI" },
  { value: "card", label: "Card" },
  { value: "credit", label: "Credit" },
]

const STATUS_OPTIONS = [
  { value: "paid", label: "Paid" },
  { value: "draft", label: "Draft" },
  { value: "cancelled", label: "Cancelled" },
]

const statusVariant: Record<string, "default" | "secondary" | "destructive"> = {
  paid: "default",
  draft: "secondary",
  cancelled: "destructive",
}

interface FormValues {
  payment_method: string
  status: string
  notes: string
}

interface Props {
  invoice: Invoice | null
  onOpenChange: (open: boolean) => void
}

export function EditInvoiceSheet({ invoice, onOpenChange }: Props) {
  const qc = useQueryClient()

  const { register, handleSubmit, setValue, watch, reset } = useForm<FormValues>({
    defaultValues: { payment_method: "cash", status: "paid", notes: "" },
  })

  useEffect(() => {
    if (invoice) {
      reset({
        payment_method: invoice.payment_method,
        status: invoice.status,
        notes: invoice.notes ?? "",
      })
    }
  }, [invoice, reset])

  const mutation = useMutation({
    mutationFn: (values: FormValues) =>
      updateInvoice(invoice!.id, {
        payment_method: values.payment_method,
        status: values.status,
        notes: values.notes || null,
      }),
    onSuccess: () => {
      toast.success("Invoice updated")
      qc.invalidateQueries({ queryKey: ["invoices"] })
      onOpenChange(false)
    },
    onError: () => toast.error("Failed to update invoice"),
  })

  if (!invoice) return null

  const customerName = invoice.customer?.name ?? invoice.walk_in_customer_name ?? "Walk-in"
  const customerPhone = invoice.customer?.phone ?? invoice.walk_in_customer_phone

  return (
    <Sheet open={!!invoice} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full max-w-none overflow-y-auto border-l sm:!w-[min(64rem,50vw)]"
      >
        <SheetHeader className="pb-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <SheetTitle className="font-mono text-lg">{invoice.invoice_number}</SheetTitle>
              <p className="text-xs text-muted-foreground mt-0.5">{date(invoice.created_at)}</p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0 pt-0.5">
              <Badge variant={statusVariant[invoice.status] ?? "secondary"} className="text-xs">
                {invoice.status}
              </Badge>
              <WhatsAppShareButton invoice={invoice} variant="icon" />
              <Button
                variant="outline"
                size="icon"
                className="size-8"
                title="Print invoice"
                onClick={() => printInvoice(invoice)}
              >
                <Printer className="size-3.5" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="size-8"
                title="Download PDF"
                onClick={() => downloadInvoicePdf(invoice)}
              >
                <Download className="size-3.5" />
              </Button>
            </div>
          </div>
        </SheetHeader>

        <div className="flex flex-col gap-4 px-4 pb-4 mt-4">
          {/* Customer */}
          <div className="rounded-md border p-3 text-sm">
            <p className="text-xs text-muted-foreground mb-1">Customer</p>
            <p className="font-medium">{customerName}</p>
            {customerPhone && <p className="text-muted-foreground text-xs mt-0.5">{customerPhone}</p>}
          </div>

          {/* Items */}
          <div className="rounded-md border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead className="text-center w-14">Qty</TableHead>
                  <TableHead className="text-right w-28">Rate</TableHead>
                  <TableHead className="text-right w-28">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoice.items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="text-sm">{item.product_name}</TableCell>
                    <TableCell className="text-center text-sm">{item.quantity}</TableCell>
                    <TableCell className="text-right text-sm">{currency(item.unit_price)}</TableCell>
                    <TableCell className="text-right text-sm font-medium">{currency(item.line_total)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Totals */}
          <div className="rounded-md border p-3 text-sm space-y-1.5 bg-muted/30">
            <div className="flex justify-between text-muted-foreground">
              <span>Subtotal</span>
              <span>{currency(invoice.subtotal)}</span>
            </div>
            {parseFloat(invoice.tax_rate) > 0 && (
              <div className="flex justify-between text-muted-foreground">
                <span>Tax ({invoice.tax_rate}%)</span>
                <span>{currency(invoice.tax_amount)}</span>
              </div>
            )}
            <Separator />
            <div className="flex justify-between font-semibold text-base">
              <span>Total</span>
              <span>{currency(invoice.total)}</span>
            </div>
          </div>

          <Separator />

          {/* Edit form */}
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Edit details</p>
          <form onSubmit={handleSubmit((v) => mutation.mutate(v))} className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label>Payment method</Label>
                <Select value={watch("payment_method")} onValueChange={(v) => {
                  if (v) setValue("payment_method", v)
                }}>
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
              <div className="flex flex-col gap-1.5">
                <Label>Status</Label>
                <Select value={watch("status")} onValueChange={(v) => {
                  if (v) setValue("status", v)
                }}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((s) => (
                      <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit_notes">Notes</Label>
              <Input id="edit_notes" placeholder="Optional" {...register("notes")} />
            </div>

            <Button type="submit" disabled={mutation.isPending} className="w-full mt-1">
              {mutation.isPending ? "Saving…" : "Save changes"}
            </Button>
          </form>
        </div>
      </SheetContent>
    </Sheet>
  )
}
