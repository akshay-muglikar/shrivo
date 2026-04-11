import { useState } from "react"
import { toast } from "sonner"
import { CheckCircle, Download, Printer, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { currency } from "@/lib/formatters"
import { getInvoiceSettings } from "../utils/invoiceSettings"
import { shareInvoiceViaWhatsApp } from "../utils/whatsappShare"
import { printInvoice } from "../utils/printInvoice"
import type { Invoice } from "../api/invoices.api"

// WhatsApp SVG icon
const WA_ICON = (
  <svg viewBox="0 0 24 24" className="size-5 fill-current shrink-0" aria-hidden>
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
  </svg>
)

interface Props {
  invoice: Invoice | null
  open: boolean
  onClose: () => void
}

export function InvoiceSuccessDialog({ invoice, open, onClose }: Props) {
  const [waPending, setWaPending] = useState(false)
  const settings = getInvoiceSettings()

  if (!invoice) return null

  const customerName =
    invoice.customer?.name ?? invoice.walk_in_customer_name ?? "Walk-in"

  async function handleWhatsApp() {
    if (!invoice || waPending) return
    setWaPending(true)
    try {
      const mode = await shareInvoiceViaWhatsApp(invoice, settings)
      if (mode === "pdf") {
        toast.success("Invoice shared with PDF on WhatsApp 🎉")
      } else if (mode === "text") {
        toast.success("WhatsApp opened with message")
      } else {
        toast.success("WhatsApp opened")
      }
    } catch {
      toast.error("Could not open WhatsApp")
    } finally {
      setWaPending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-green-100 dark:bg-green-900/40 p-2 shrink-0">
              <CheckCircle className="size-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <DialogTitle className="text-base">Invoice Created!</DialogTitle>
              <p className="text-sm text-muted-foreground mt-0.5">
                {invoice.invoice_number} · {customerName}
              </p>
            </div>
          </div>
        </DialogHeader>

        {/* Amount display */}
        <div className="rounded-xl bg-muted/40 border px-5 py-4 text-center space-y-0.5">
          <p className="text-3xl font-bold tracking-tight">{currency(invoice.total)}</p>
          <p className="text-sm text-muted-foreground capitalize">
            {invoice.payment_method} · {invoice.items.length} item{invoice.items.length !== 1 ? "s" : ""}
          </p>
        </div>

        {/* Primary action — WhatsApp */}
        {settings.whatsappEnabled && (
          <Button
            size="lg"
            className="w-full bg-[#25D366] hover:bg-[#128C7E] text-white gap-2 font-semibold text-base h-12"
            disabled={waPending}
            onClick={handleWhatsApp}
          >
            {waPending ? (
              <>
                <svg className="size-5 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                Preparing PDF…
              </>
            ) : (
              <>
                {WA_ICON}
                Send via WhatsApp
              </>
            )}
          </Button>
        )}

        {/* Secondary actions */}
        <div className="grid grid-cols-3 gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => printInvoice(invoice)}
          >
            <Printer className="size-3.5" />
            Print
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => printInvoice(invoice)}
          >
            <Download className="size-3.5" />
            PDF
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5"
            onClick={onClose}
          >
            <X className="size-3.5" />
            Done
          </Button>
        </div>

        {/* Hint */}
        <p className="text-center text-[11px] text-muted-foreground">
          {typeof navigator.share === "function"
            ? "📎 PDF will be attached automatically on mobile"
            : "💬 WhatsApp will open with a pre-filled message"}
        </p>
      </DialogContent>
    </Dialog>
  )
}
