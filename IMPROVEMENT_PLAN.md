# Feature & Improvement Plan

Audit of the existing implementation — issues found, features missing, and prioritised improvements.

> **✅ Completed items have been removed.** See git history for what was implemented.

---

## P1 — Quick Wins (< 1 day each)

### 6. Customer outstanding balance (credit tracking)

**Current:** Customers have no balance field. Credit payment method exists on invoices but nothing tracks what the customer owes.

**Add:**
- `balance` column on `customers` table (like `suppliers.balance`)
- When an invoice with `payment_method = "credit"` is created → `customer.balance += invoice.total`
- New `POST /customers/{id}/payments` endpoint → reduces balance
- Show balance on Customers page and customer detail

**Files:** `models/customer.py`, `routers/customers.py`, `schemas/customer.py` + frontend CustomersPage

---

### 7. Expense category summary on dashboard

**Current:** Expenses have a `category` field but it is never aggregated.

**Add** to dashboard summary response:
```json
"expense_breakdown": [
  {"category": "Rent", "total": 15000},
  {"category": "Utilities", "total": 3200}
]
```

And a small breakdown card/list on the dashboard below the stat cards.

---

### 11. Expense category autocomplete

**Current:** The expense category field is a free-text input — users mistype ("Transport", "transport", "TRANSPORT" become 3 different categories).

**Fix:** `GET /expenses/categories` endpoint that returns distinct category names used so far. Front-end shows a datalist/combobox instead of a plain input.

---

## P2 — High Value Features (1–3 days each)

### 13. GST breakdown (CGST / SGST / IGST)

**Current:** A single flat `tax_rate` field — not compliant with Indian GST invoicing requirements.

**Add:**
- `gst_type: "cgst_sgst" | "igst" | "none"` on `Invoice`
- When `cgst_sgst`: tax is split 50/50 — printed as CGST 9% + SGST 9%
- When `igst`: single line — IGST 18%
- Invoice PDF and thermal receipt templates updated to show the correct split
- GSTIN field in shop settings (already in multi-shop plan, add it to localStorage settings in the interim)

---

### 14. Return / refund flow

**Current:** No way to process a product return. Cancelling an invoice does not restore stock.

**Add:** `POST /invoices/{id}/return` endpoint:
- Creates a credit note (new `Invoice` with negative totals and status `"returned"`)
- Restores stock for each item via `MovementType.RETURN`
- Deducts from customer balance if it was a credit sale
- Printable credit note PDF

---

### 15. Global search

**Current:** Each page has its own search box. No way to find "INV-0042" or "Metro Wholesale" from one place.

**Add:** `GET /search?q=<term>` endpoint that queries across:
- Products (name, SKU)
- Invoices (invoice number, customer name)
- Customers (name, phone)
- Suppliers (name)

Frontend: `Cmd+K` opens a command palette (shadcn `Command` component already imported in the codebase) showing results grouped by type with links.

---

### 16. Customer statement / ledger

**Current:** `GET /customers/{id}/invoices` exists but shows raw invoice rows with no summary.

**Add:** A customer detail sheet (similar to SupplierDetailSheet) with:
- **Summary tab:** total spent, outstanding balance, last purchase date
- **Transactions tab:** invoices + payments in chronological order with running balance
- **Record payment** inline (reduces balance)

---

### 17. Supplier ledger report

**Current:** Supplier detail shows PO list and payment history in separate tabs, but no running balance ledger.

**Add** to SupplierDetailSheet Account tab: a combined chronological ledger:

| Date | Description | Debit (added) | Credit (paid) | Balance |
|---|---|---|---|---|
| Apr 1 | PO-0012 received | ₹12,000 | — | ₹12,000 |
| Apr 5 | Payment | — | ₹5,000 | ₹7,000 |

---

### 18. Low stock WhatsApp alert

**Current:** Twilio credentials are in `.env` but only used for the contact page. Low stock is only visible by logging into the app.

**Add:** A scheduled/triggered notification:
- After any stock deduction, if `product.current_stock <= product.low_stock_threshold`, send a WhatsApp message to the shop owner's phone
- Toggle in Settings to enable/disable

---

### 19. Product image

**Current:** No image support.

**Add:**
- `image_url: str | None` on `Product` model
- `POST /products/{id}/image` — accepts multipart upload, stores to Supabase Storage, returns URL
- Product card in the UI shows a small thumbnail

---

### 20. Bulk CSV import for products

**Current:** Products are added one at a time.

**Add:** `POST /products/import` — accepts a CSV file with columns:
`name, sku, category, supplier, cost_price, selling_price, current_stock, unit`

Frontend: "Import CSV" button on Products page → file picker → preview table → confirm.

---

## P3 — Medium Features (3–5 days each)

### 21. Profit & Loss report

**Add:** `GET /reports/profit-loss?date_from=&date_to=` with full revenue/COGS/expenses breakdown. Downloadable as PDF.

---

### 22. Inventory valuation report

**Add:** `GET /reports/inventory` — per product: SKU, name, qty, cost price, total value, selling price, potential revenue, margin %. Sortable, filterable, downloadable as CSV.

---

### 23. Invoice draft workflow

**Add:** `status: "draft" | "pending" | "paid" | "cancelled"` — draft/pending do not deduct stock; stock deducted only when status moves to paid.

---

### 24. Barcode support

**Add:**
- `barcode: str | None` field on `Product`
- Barcode generation: `GET /products/{id}/barcode` returns a PNG
- Print barcode labels from Products page
- Barcode scanner input on invoice creation

---

### 25. Recurring expenses

**Add** `is_recurring`, `recurrence`, `next_due` fields on `Expense`. Background task auto-creates next expense on due date.

---

## P4 — Major Features (1+ week each)

### 26. Mobile app (PWA)

Add `vite-plugin-pwa`, offline mode, "Add to home screen" prompt, push notifications for low stock.

---

### 27. Analytics & trends

Dedicated `/app/analytics` page: top 10 products, top 10 customers, revenue by category, stock turnover, month-over-month chart.

---

### 28. Multi-currency support

`currency` field on Shop (ISO 4217). Formatters use shop currency. Full plan in MULTI_SHOP_PLAN.md.

---

## Technical Debt

| Item | File | Fix |
|---|---|---|
| `response_model=dict` on most list endpoints | All routers | Define typed `PaginatedResponse[X]` schemas |
| No `updated_at` on Supplier, Customer, Expense | Models | Add for audit purposes |
| `created_by_id` missing on Expense update | `routers/expenses.py` | Track who last modified |
| No API response compression | `main.py` | Add `GZipMiddleware` |

```python
# app/main.py — add GZip compression for responses > 1KB
from fastapi.middleware.gzip import GZipMiddleware
app.add_middleware(GZipMiddleware, minimum_size=1000)
```

---

## Priority Matrix

```
            │  Low effort   │  High effort  │
────────────┼───────────────┼───────────────┤
High value  │ #6  Customer  │ #14 Returns   │
            │ #7  Expenses  │ #15 Search    │
            │ #11 Exp cat   │ #21 P&L rpt   │
            │               │ #23 Drafts    │
────────────┼───────────────┼───────────────┤
Low value   │               │ #24 Barcode   │
            │               │ #25 Recurring │
            │               │ #26 PWA       │
```

**Recommended next items:**
1. **#6 Customer outstanding balance** — mirrors existing supplier account feature, high user value
2. **#7 Expense category summary** — easy GROUP BY addition to dashboard
3. **#15 Global search** — Cmd+K command palette, shadcn Command already in codebase
