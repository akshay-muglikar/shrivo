import type { Invoice } from "../api/invoices.api"
import {
  getInvoiceSettings,
  isThermal,
  type InvoiceSettings,
  type InvoiceTemplate,
  type InvoiceSize,
} from "./invoiceSettings"

const fmt = (v: number | string) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(Number(v))

const fmtDate = (v: string) =>
  new Date(v).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })

const paymentLabel: Record<string, string> = {
  cash: "Cash", upi: "UPI", card: "Card", credit: "Credit",
}

function normalizeState(value: string | null | undefined) {
  return value?.trim().toUpperCase() || ""
}

function isInterStateSale(invoice: Invoice, settings: InvoiceSettings) {
  const shopState = normalizeState(settings.shopState)
  const customerState = normalizeState(invoice.customer?.state)
  return Boolean(shopState && customerState && shopState !== customerState)
}

function getGstRows(invoice: Invoice, settings: InvoiceSettings) {
  const taxRate = parseFloat(invoice.tax_rate)
  const taxAmount = parseFloat(invoice.tax_amount)

  if (!settings.gstEnabled || taxRate <= 0 || taxAmount <= 0) {
    return [] as Array<{ label: string; amount: number }>
  }

  if (isInterStateSale(invoice, settings)) {
    return [{ label: `IGST (${taxRate}%)`, amount: taxAmount }]
  }

  const halfRate = taxRate / 2
  const halfAmount = taxAmount / 2
  return [
    { label: `CGST (${halfRate}%)`, amount: halfAmount },
    { label: `SGST (${halfRate}%)`, amount: halfAmount },
  ]
}

function getItemGstRate(invoice: Invoice, item: Invoice["items"][number]) {
  const itemRate = parseFloat(item.gst_rate ?? "0")
  if (itemRate > 0) return itemRate
  return parseFloat(invoice.tax_rate)
}

function getItemGstDetail(invoice: Invoice, item: Invoice["items"][number], settings: InvoiceSettings) {
  if (!settings.gstEnabled) return null

  const gstRate = getItemGstRate(invoice, item)
  if (gstRate <= 0) return null

  const taxableAmount = parseFloat(item.line_total)
  const gstAmount = taxableAmount * gstRate / 100
  const grossAmount = taxableAmount + gstAmount

  if (isInterStateSale(invoice, settings)) {
    return {
      text: `${fmt(taxableAmount)} + IGST ${gstRate}% ${fmt(gstAmount)} = ${fmt(grossAmount)}`,
    }
  }

  const halfRate = gstRate / 2
  const halfAmount = gstAmount / 2
  return {
    text: `${fmt(taxableAmount)} + CGST ${halfRate}% ${fmt(halfAmount)} · SGST ${halfRate}% ${fmt(halfAmount)} = ${fmt(grossAmount)}`,
  }
}

// ── @page rule ────────────────────────────────────────────────────
function pageRule(size: InvoiceSize): string {
  if (size === "80mm") return `@page { size: 80mm auto; margin: 3mm 4mm; }`
  if (size === "58mm") return `@page { size: 58mm auto; margin: 2mm 3mm; }`
  const margins: Record<string, string> = { A4: "12mm", A5: "8mm", Letter: "12mm" }
  return `@page { size: ${size}; margin: ${margins[size]}; }`
}

// ── Thermal receipt template (monospace, single column) ───────────
function thermalHtml(invoice: Invoice, width: "80mm" | "58mm", s: InvoiceSettings): string {
  const w = width === "58mm" ? 280 : 380
  const shopName = s.shopName || "Shop Manager"
  const shopTagline = s.shopTagline || "Inventory & Billing"
  const shopAddress = s.shopAddress
  const shopPhone = s.shopPhone
  const shopEmail = s.shopEmail
  const shopGstin = s.gstEnabled ? s.shopGstin : ""
  const shopState = s.gstEnabled ? s.shopState : ""
  const customerName =
    invoice.customer?.name ?? invoice.walk_in_customer_name ?? "Walk-in"
  const customerPhone = invoice.customer?.phone ?? invoice.walk_in_customer_phone
  const customerGstin = s.gstEnabled ? invoice.customer?.gstin ?? "" : ""
  const customerState = s.gstEnabled ? invoice.customer?.state ?? "" : ""
  const gstRows = getGstRows(invoice, s)
  const taxableValue = parseFloat(invoice.subtotal) - parseFloat(invoice.discount_amount ?? "0")

  const rows = invoice.items
    .map(
      (item) => {
        const itemGstDetail = getItemGstDetail(invoice, item, s)
        return `
      <tr>
        <td colspan="3" style="padding:1px 0 0">${item.product_name}${s.gstEnabled && item.hsn_code ? `<div style="font-size:9px;color:#666">HSN: ${item.hsn_code}</div>` : ""}</td>
      </tr>
      <tr>
        <td style="color:#555">${item.quantity} × ${fmt(item.unit_price)}</td>
        <td></td>
        <td style="text-align:right;font-weight:600">${fmt(item.line_total)}</td>
      </tr>
      ${itemGstDetail ? `<tr><td colspan="3" style="font-size:9px;color:#92400e;padding:1px 0 0">${itemGstDetail.text}</td></tr>` : ""}`
      }
    )
    .join("<tr><td colspan='3' style='padding:1px 0'></td></tr>")

  const taxRow = s.gstEnabled
    ? gstRows
      .map((row) => `<tr><td colspan="2">${row.label}</td><td style="text-align:right">${fmt(row.amount)}</td></tr>`)
      .join("")
    : parseFloat(invoice.tax_rate) > 0
      ? `<tr><td colspan="2">Tax (${invoice.tax_rate}%)</td><td style="text-align:right">${fmt(invoice.tax_amount)}</td></tr>`
      : ""

  const shopGstHeaderBlock = s.gstEnabled
    ? `${shopGstin ? `<div class="center" style="font-size:9px;color:#555">GSTIN: ${shopGstin}</div>` : ""}
       ${shopState ? `<div class="center" style="font-size:9px;color:#555">State: ${shopState}</div>` : ""}`
    : ""

  const customerGstInfoBlock = s.gstEnabled
    ? `${customerGstin ? `<div><span style="color:#555">Customer GSTIN: </span>${customerGstin}</div>` : ""}
       ${customerState ? `<div><span style="color:#555">Place of Supply: </span>${customerState}</div>` : ""}`
    : ""

  const discountRow = parseFloat(invoice.discount_amount ?? "0") > 0
    ? `<tr class="summary-row"><td colspan="2">Discount</td><td style="text-align:right">-${fmt(invoice.discount_amount)}</td></tr>`
    : ""

  const taxableRow = s.gstEnabled
    ? `<tr class="summary-row"><td colspan="2">Taxable Value</td><td style="text-align:right">${fmt(taxableValue)}</td></tr>`
    : ""

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Invoice ${invoice.invoice_number}</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: "Courier New", Courier, monospace;
      font-size: 10px;
      color: #000;
      background: #fff;
      width: ${w}px;
      padding: 8px 6px;
    }
    .center { text-align: center; }
    .bold { font-weight: 700; }
    .divider { border: none; border-top: 1px dashed #000; margin: 6px 0; }
    table { width: 100%; border-collapse: collapse; }
    td { vertical-align: top; font-size: 10px; padding: 1px 0; }
    .summary-row td { padding: 2px 0; }
    .total-row td { font-weight: 700; font-size: 12px; border-top: 1px dashed #000; padding-top: 4px; margin-top: 2px; }
    @media print { ${pageRule(width)} }
  </style>
</head>
<body>
  <div class="center bold" style="font-size:14px;margin-bottom:2px">${shopName}</div>
  <div class="center" style="font-size:9px;color:#555">${shopTagline}</div>
  ${shopAddress ? `<div class="center" style="font-size:9px;color:#555">${shopAddress}</div>` : ""}
  ${shopPhone ? `<div class="center" style="font-size:9px;color:#555">${shopPhone}</div>` : ""}
  ${shopEmail ? `<div class="center" style="font-size:9px;color:#555;margin-bottom:6px">${shopEmail}</div>` : '<div style="margin-bottom:6px"></div>'}
  ${shopGstHeaderBlock}
  <hr class="divider"/>
  <div style="margin-bottom:4px">
    <div><span style="color:#555">Invoice: </span><span class="bold">${invoice.invoice_number}</span></div>
    <div><span style="color:#555">Date: </span>${fmtDate(invoice.created_at)}</div>
    <div><span style="color:#555">Customer: </span>${customerName}${customerPhone ? ` (${customerPhone})` : ""}</div>
    <div><span style="color:#555">Payment: </span>${paymentLabel[invoice.payment_method] ?? invoice.payment_method}</div>
    ${customerGstInfoBlock}
  </div>
  <hr class="divider"/>
  <table>
    ${rows}
  </table>
  <hr class="divider"/>
  <table>
    <tr class="summary-row"><td colspan="2">Subtotal</td><td style="text-align:right">${fmt(invoice.subtotal)}</td></tr>
    ${discountRow}
    ${taxableRow}
    ${taxRow}
    <tr class="total-row"><td colspan="2">TOTAL</td><td style="text-align:right">${fmt(invoice.total)}</td></tr>
  </table>
  ${invoice.notes ? `<hr class="divider"/><div style="font-size:9px;color:#555">Note: ${invoice.notes}</div>` : ""}
  <hr class="divider"/>
  <div class="center" style="font-size:9px;color:#555;margin-top:4px">Thank you for your business!</div>
</body>
</html>`
}

// ── Full-page template styles ─────────────────────────────────────
function templateStyles(t: InvoiceTemplate, size: InvoiceSize): string {
  const small = size === "A5"
  const base = small ? 11 : 13
  const pad = small ? "20px 24px" : "32px 40px"
  const maxW = size === "A5" ? "520px" : "780px"

  if (t === "classic") return `
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; font-size: ${base}px; color: #111; background: #fff; padding: ${pad}; max-width: ${maxW}; margin: 0 auto; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 16px; border-bottom: 2px solid #111; margin-bottom: 20px; }
    .shop-name { font-size: ${base + 9}px; font-weight: 700; letter-spacing: -0.5px; }
    .shop-sub { font-size: ${base - 1}px; color: #666; margin-top: 2px; }
    .invoice-meta { text-align: right; }
    .invoice-number { font-size: ${base + 5}px; font-weight: 700; font-family: monospace; }
    .invoice-date { font-size: ${base - 1}px; color: #666; margin-top: 3px; }
    .status-badge { display: inline-block; margin-top: 6px; padding: 2px 10px; border-radius: 999px; font-size: ${base - 2}px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; background: #d1fae5; color: #065f46; }
    .status-badge.draft { background: #f3f4f6; color: #374151; }
    .status-badge.cancelled { background: #fee2e2; color: #991b1b; }
    .parties { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px; }
    .party-label { font-size: ${base - 3}px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.8px; color: #666; margin-bottom: 4px; }
    .party-name { font-size: ${base + 2}px; font-weight: 600; }
    .party-detail { font-size: ${base - 1}px; color: #555; margin-top: 2px; }
    .summary-section { border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden; margin-bottom: 20px; }
    table { width: 100%; border-collapse: collapse; }
    thead tr { background: #f9fafb; border-bottom: 1px solid #e5e7eb; }
    thead th { padding: 7px 10px; font-size: ${base - 2}px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: #6b7280; text-align: left; }
    thead th.num { text-align: right; }
    tbody tr { border-bottom: 1px solid #f3f4f6; }
    tbody tr:last-child { border-bottom: none; }
    tbody td { padding: 8px 10px; }
    td.idx { color: #9ca3af; width: 24px; }
    td.num, th.num { text-align: right; }
    .summary-row td { padding: 7px 10px; color: #555; }
    .summary-row.total td { font-size: ${base + 2}px; font-weight: 700; color: #111; background: #f9fafb; border-top: 2px solid #111; padding: 9px 10px; }
    .payment-info { font-size: ${base - 1}px; color: #666; margin-bottom: 28px; }
    .payment-info span { font-weight: 600; color: #111; }
    .footer { border-top: 1px solid #e5e7eb; padding-top: 14px; font-size: ${base - 2}px; color: #9ca3af; text-align: center; }
  `

  if (t === "modern") return `
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; font-size: ${base}px; color: #1e293b; background: #fff; padding: 0; max-width: ${maxW}; margin: 0 auto; }
    .header { background: #1e293b; color: #fff; padding: ${small ? "20px 24px" : "28px 40px"}; display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; }
    .shop-name { font-size: ${base + 9}px; font-weight: 700; letter-spacing: -0.5px; color: #fff; }
    .shop-sub { font-size: ${base - 1}px; color: #94a3b8; margin-top: 2px; }
    .invoice-meta { text-align: right; }
    .invoice-number { font-size: ${base + 5}px; font-weight: 700; font-family: monospace; color: #fff; }
    .invoice-date { font-size: ${base - 1}px; color: #94a3b8; margin-top: 3px; }
    .status-badge { display: inline-block; margin-top: 6px; padding: 2px 10px; border-radius: 999px; font-size: ${base - 2}px; font-weight: 600; text-transform: uppercase; background: #22c55e; color: #fff; }
    .status-badge.draft { background: #64748b; }
    .status-badge.cancelled { background: #ef4444; }
    .body-pad { padding: ${small ? "0 24px" : "0 40px"}; }
    .parties { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px; }
    .party-label { font-size: ${base - 3}px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.8px; color: #64748b; margin-bottom: 4px; }
    .party-name { font-size: ${base + 2}px; font-weight: 600; color: #0f172a; }
    .party-detail { font-size: ${base - 1}px; color: #64748b; margin-top: 2px; }
    .summary-section { border-radius: 10px; overflow: hidden; margin-bottom: 20px; box-shadow: 0 1px 4px rgba(0,0,0,0.07); }
    table { width: 100%; border-collapse: collapse; }
    thead tr { background: #f1f5f9; }
    thead th { padding: 8px 12px; font-size: ${base - 2}px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: #475569; text-align: left; }
    thead th.num { text-align: right; }
    tbody tr { border-bottom: 1px solid #f1f5f9; }
    tbody tr:last-child { border-bottom: none; }
    tbody td { padding: 9px 12px; }
    td.idx { color: #cbd5e1; width: 24px; }
    td.num, th.num { text-align: right; }
    .summary-row td { padding: 7px 12px; color: #64748b; background: #f8fafc; }
    .summary-row.total td { font-size: ${base + 2}px; font-weight: 700; color: #fff; background: #1e293b; padding: 10px 12px; }
    .payment-info { font-size: ${base - 1}px; color: #64748b; margin-bottom: 28px; }
    .payment-info span { font-weight: 600; color: #0f172a; }
    .footer { border-top: 1px solid #e2e8f0; padding-top: 14px; font-size: ${base - 2}px; color: #94a3b8; text-align: center; margin: 0 ${small ? "24px" : "40px"} ${small ? "20px" : "32px"}; }
  `

  // minimal
  return `
    body { font-family: "Georgia", "Times New Roman", serif; font-size: ${base}px; color: #222; background: #fff; padding: ${pad}; max-width: ${maxW}; margin: 0 auto; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 28px; }
    .shop-name { font-size: ${base + 7}px; font-weight: 700; letter-spacing: -0.5px; }
    .shop-sub { font-size: ${base - 1}px; color: #888; margin-top: 2px; }
    .invoice-meta { text-align: right; }
    .invoice-number { font-size: ${base + 3}px; font-weight: 400; font-family: monospace; color: #444; }
    .invoice-date { font-size: ${base - 1}px; color: #888; margin-top: 3px; }
    .status-badge { display: inline-block; margin-top: 6px; padding: 1px 8px; border: 1px solid #ccc; border-radius: 4px; font-size: ${base - 2}px; font-weight: 600; text-transform: uppercase; color: #444; }
    .status-badge.draft { color: #888; border-color: #ddd; }
    .status-badge.cancelled { color: #991b1b; border-color: #fca5a5; }
    .parties { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 24px; border-top: 1px solid #ddd; border-bottom: 1px solid #ddd; padding: 14px 0; }
    .party-label { font-size: ${base - 3}px; text-transform: uppercase; letter-spacing: 1px; color: #999; margin-bottom: 4px; }
    .party-name { font-size: ${base + 1}px; font-weight: 600; }
    .party-detail { font-size: ${base - 1}px; color: #666; margin-top: 2px; }
    .summary-section { margin-bottom: 20px; }
    table { width: 100%; border-collapse: collapse; }
    thead tr { border-bottom: 1px solid #222; }
    thead th { padding: 6px 8px; font-size: ${base - 2}px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: #444; text-align: left; }
    thead th.num { text-align: right; }
    tbody tr { border-bottom: 1px solid #eee; }
    tbody tr:last-child { border-bottom: none; }
    tbody td { padding: 8px 8px; }
    td.idx { color: #bbb; width: 24px; }
    td.num, th.num { text-align: right; }
    .summary-row td { padding: 6px 8px; color: #555; }
    .summary-row.total td { font-size: ${base + 1}px; font-weight: 700; color: #111; border-top: 1px solid #222; padding: 8px 8px; }
    .payment-info { font-size: ${base - 1}px; color: #777; margin-bottom: 28px; }
    .payment-info span { font-weight: 600; color: #333; }
    .footer { padding-top: 14px; font-size: ${base - 2}px; color: #bbb; text-align: center; font-style: italic; }
  `
}

// ── Full-page HTML builder ────────────────────────────────────────
function buildFullPageHtml(invoice: Invoice, s: InvoiceSettings): string {
  const isModern = s.template === "modern"
  const shopName = s.shopName || "Shop Manager"
  const shopTagline = s.shopTagline || "Inventory & Billing"
  const gstinLine = s.gstEnabled && s.shopGstin ? `GSTIN: ${s.shopGstin}` : null
  const shopStateLine = s.gstEnabled && s.shopState ? `State: ${s.shopState}` : null
  const shopMeta = [s.shopAddress, s.shopPhone, s.shopEmail, gstinLine, shopStateLine].filter(Boolean)
  const customerName =
    invoice.customer?.name ?? invoice.walk_in_customer_name ?? "Walk-in Customer"
  const customerPhone = invoice.customer?.phone ?? invoice.walk_in_customer_phone
  const customerState = invoice.customer?.state ?? null
  const gstRows = getGstRows(invoice, s)
  const taxableValue = parseFloat(invoice.subtotal) - parseFloat(invoice.discount_amount ?? "0")

  const showHsn = s.gstEnabled && invoice.items.some((i) => i.hsn_code)

  const itemRows = invoice.items
    .map(
      (item, i) => {
        const itemGstDetail = getItemGstDetail(invoice, item, s)
        return `
    <tr>
      <td class="idx">${i + 1}</td>
      <td>${item.product_name}${showHsn && item.hsn_code ? `<div style="font-size:10px;color:#888">HSN: ${item.hsn_code}</div>` : ""}${itemGstDetail ? `<div style="font-size:10px;color:#b45309;margin-top:2px">${itemGstDetail.text}</div>` : ""}</td>
      <td class="num">${item.quantity}</td>
      <td class="num">${fmt(item.unit_price)}</td>
      <td class="num">${fmt(item.line_total)}</td>
    </tr>`
      }
    )
    .join("")

  const taxRows = s.gstEnabled
    ? gstRows
      .map((row) => `<tr class="summary-row"><td colspan="4">${row.label}</td><td class="num">${fmt(row.amount)}</td></tr>`)
      .join("")
    : parseFloat(invoice.tax_rate) > 0
      ? `<tr class="summary-row"><td colspan="4">Tax (${invoice.tax_rate}%)</td><td class="num">${fmt(invoice.tax_amount)}</td></tr>`
      : ""

  const discountRow =
    parseFloat(invoice.discount_amount ?? "0") > 0
      ? `<tr class="summary-row"><td colspan="4" style="color:#16a34a">Discount</td><td class="num" style="color:#16a34a">−${fmt(invoice.discount_amount)}</td></tr>`
      : ""

  const taxableRow = s.gstEnabled
    ? `<tr class="summary-row"><td colspan="4">Taxable Value</td><td class="num">${fmt(taxableValue)}</td></tr>`
    : ""

  const tableSection = `
    <div class="summary-section">
      <table>
        <thead>
          <tr>
            <th style="width:24px">#</th>
            <th>Item</th>
            <th class="num" style="width:50px">Qty</th>
            <th class="num" style="width:100px">Rate</th>
            <th class="num" style="width:110px">Amount</th>
          </tr>
        </thead>
        <tbody>
          ${itemRows}
          <tr class="summary-row"><td colspan="4">Subtotal</td><td class="num">${fmt(invoice.subtotal)}</td></tr>
          ${discountRow}
          ${taxableRow}
          ${taxRows}
          <tr class="summary-row total"><td colspan="4">Total</td><td class="num">${fmt(invoice.total)}</td></tr>
        </tbody>
      </table>
    </div>`

  const customerGstin = invoice.customer?.gstin ?? null
  const partiesHtml = `
    <div class="parties">
      <div>
        <div class="party-label">Bill to</div>
        <div class="party-name">${customerName}</div>
        ${customerPhone ? `<div class="party-detail">${customerPhone}</div>` : ""}
        ${s.gstEnabled && customerGstin ? `<div class="party-detail">GSTIN: ${customerGstin}</div>` : ""}
        ${s.gstEnabled && customerState ? `<div class="party-detail">State: ${customerState}</div>` : ""}
      </div>
      <div style="text-align:right">
        <div class="party-label">Payment</div>
        <div class="party-name">${paymentLabel[invoice.payment_method] ?? invoice.payment_method}</div>
        ${s.gstEnabled ? `<div class="party-detail">Supply Type: ${isInterStateSale(invoice, s) ? "Inter-state" : "Intra-state"}</div>` : ""}
      </div>
    </div>`

  const notesHtml = invoice.notes
    ? `<div class="payment-info" style="margin-bottom:12px">Notes: <span>${invoice.notes}</span></div>`
    : ""

  const bodyContent = isModern
    ? `<div class="body-pad">${partiesHtml}${tableSection}${notesHtml}</div>
       <div class="footer">Thank you for your business!</div>`
    : `${partiesHtml}${tableSection}${notesHtml}
       <div class="footer">Thank you for your business!</div>`

  const docTitle = s.gstEnabled ? "TAX INVOICE" : "INVOICE"

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>${docTitle} ${invoice.invoice_number}</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    ${templateStyles(s.template, s.size)}
    @media print { ${pageRule(s.size)} }
  </style>
</head>
<body>
  ${s.gstEnabled ? `<div style="text-align:center;font-weight:700;font-size:15px;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:10px;border-bottom:1px solid #e5e7eb;padding-bottom:8px">Tax Invoice</div>` : ""}
  <div class="header">
    <div>
      <div class="shop-name">${shopName}</div>
      <div class="shop-sub">${shopTagline}</div>
      ${shopMeta.map((line) => `<div class="shop-sub">${line}</div>`).join("")}
    </div>
    <div class="invoice-meta">
      <div class="invoice-number">${invoice.invoice_number}</div>
      <div class="invoice-date">${fmtDate(invoice.created_at)}</div>
      <span class="status-badge ${invoice.status}">${invoice.status.toUpperCase()}</span>
    </div>
  </div>
  ${bodyContent}
</body>
</html>`
}

// ── Public API ────────────────────────────────────────────────────
export function buildInvoiceHtml(invoice: Invoice, settings?: InvoiceSettings): string {
  const s = settings ?? getInvoiceSettings()
  if (isThermal(s.size)) return thermalHtml(invoice, s.size as "80mm" | "58mm", s)
  return buildFullPageHtml(invoice, s)
}

export function printInvoice(invoice: Invoice) {
  const s = getInvoiceSettings()
  const win = window.open("", "_blank", "width=900,height=700")
  if (!win) return
  win.document.write(buildInvoiceHtml(invoice, s))
  win.document.close()
  win.focus()
  setTimeout(() => win.print(), 400)
}

export function downloadInvoicePdf(invoice: Invoice) {
  printInvoice(invoice)
}
