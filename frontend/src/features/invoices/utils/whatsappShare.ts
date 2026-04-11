import type { Invoice } from "../api/invoices.api"
import type { InvoiceSettings } from "./invoiceSettings"
import { buildInvoiceHtml } from "./printInvoice"

// ── Message template ──────────────────────────────────────────────

const paymentLabel: Record<string, string> = {
  cash: "Cash", upi: "UPI", card: "Card", credit: "Credit",
}

const fmt = (v: number | string) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(Number(v))

export const DEFAULT_WA_TEMPLATE = `Hi {customer_name} 👋,

Your invoice *{invoice_number}* from *{shop_name}* is ready.

🛒 *{item_count} item(s)*
💰 *Total: {total}*
💳 Payment: {payment_method}

Thank you for your business! 🙏

— {shop_name}
📞 {shop_phone}`

export function buildWhatsAppMessage(invoice: Invoice, settings: InvoiceSettings): string {
  const template = settings.whatsappTemplate || DEFAULT_WA_TEMPLATE
  const customerName =
    invoice.customer?.name ?? invoice.walk_in_customer_name ?? "there"
  return template
    .replace(/\{customer_name\}/g, customerName)
    .replace(/\{invoice_number\}/g, invoice.invoice_number)
    .replace(/\{item_count\}/g, String(invoice.items.length))
    .replace(/\{total\}/g, fmt(invoice.total))
    .replace(/\{payment_method\}/g, paymentLabel[invoice.payment_method] ?? invoice.payment_method)
    .replace(/\{shop_name\}/g, settings.shopName || "")
    .replace(/\{shop_phone\}/g, settings.shopPhone || "")
}

// ── PDF blob generation (lazy-loads jspdf + html2canvas) ──────────

export async function generateInvoicePdfBlob(
  invoice: Invoice,
  settings: InvoiceSettings,
): Promise<Blob> {
  const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
    import("html2canvas"),
    import("jspdf"),
  ])

  const htmlString = buildInvoiceHtml(invoice, settings)

  // Render in a hidden iframe to preserve full <head> styles
  const iframe = document.createElement("iframe")
  iframe.style.cssText =
    "position:fixed;left:-9999px;top:0;width:794px;height:1px;border:none;visibility:hidden;"
  document.body.appendChild(iframe)

  await new Promise<void>((resolve) => {
    iframe.addEventListener("load", () => resolve(), { once: true })
    const doc = iframe.contentDocument!
    doc.open()
    doc.write(htmlString)
    doc.close()
  })

  // Expand to full content height before capturing
  const iframeDoc = iframe.contentDocument!
  iframe.style.height = iframeDoc.documentElement.scrollHeight + "px"

  try {
    const canvas = await html2canvas(iframeDoc.documentElement, {
      scale: 1.5,
      useCORS: true,
      logging: false,
      backgroundColor: "#ffffff",
    })

    const imgData = canvas.toDataURL("image/jpeg", 0.92)
    const pdfWidthMm = 210 // A4
    const pdfHeightMm = (canvas.height * pdfWidthMm) / canvas.width

    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: [pdfWidthMm, Math.max(pdfHeightMm, 297)], // at least A4 height
    })
    pdf.addImage(imgData, "JPEG", 0, 0, pdfWidthMm, pdfHeightMm)

    return pdf.output("blob")
  } finally {
    document.body.removeChild(iframe)
  }
}

// ── Share orchestration ───────────────────────────────────────────

export type ShareMode = "pdf" | "text" | "link"

/** Opens WhatsApp with a pre-filled message via wa.me deep-link. */
export function openWhatsAppLink(phone: string | null | undefined, message: string) {
  const clean = phone?.replace(/\D/g, "")
  const base = clean ? `https://wa.me/${clean}` : "https://wa.me/"
  window.open(`${base}?text=${encodeURIComponent(message)}`, "_blank", "noopener")
}

/**
 * Phase 2 share flow:
 *   1. Mobile with file support → Web Share API with PDF attached
 *   2. Mobile without file support → Web Share API text-only (user picks WhatsApp)
 *   3. Desktop / everything else → wa.me deep-link
 *
 * Returns which mode was used.
 */
export async function shareInvoiceViaWhatsApp(
  invoice: Invoice,
  settings: InvoiceSettings,
): Promise<ShareMode> {
  const message = buildWhatsAppMessage(invoice, settings)
  const phone = invoice.customer?.phone ?? invoice.walk_in_customer_phone

  if (typeof navigator.share === "function") {
    // Attempt 1: PDF + text via Web Share API
    try {
      const blob = await generateInvoicePdfBlob(invoice, settings)
      const file = new File([blob], `${invoice.invoice_number}.pdf`, { type: "application/pdf" })

      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], text: message })
        return "pdf"
      }
    } catch (err) {
      // AbortError = user dismissed the share sheet — treat as success (no fallback)
      if (err instanceof Error && err.name === "AbortError") return "pdf"
      // Other error (PDF gen failed, etc.) — fall through to text share
    }

    // Attempt 2: text-only Web Share API
    try {
      await navigator.share({ text: message })
      return "text"
    } catch {
      // Fall through to link
    }
  }

  // Attempt 3: wa.me deep-link (desktop / unsupported browsers)
  openWhatsAppLink(phone, message)
  return "link"
}
