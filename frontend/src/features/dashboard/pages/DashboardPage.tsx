import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Link } from "react-router-dom"
import {
  AlertTriangle,
  ArrowRight,
  BadgeIndianRupee,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react"
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { getDashboardSummary } from "../api/dashboard.api"
import { currency } from "@/lib/formatters"

// ── Date helpers ───────────────────────────────────────────────
function toISO(d: Date) {
  return d.toISOString().split("T")[0]
}

function today() { return toISO(new Date()) }

function lastN(n: number) {
  const d = new Date()
  d.setDate(d.getDate() - (n - 1))
  return toISO(d)
}

function lastMonthRange(): { from: string; to: string } {
  const now = new Date()
  const firstOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const lastOfLastMonth = new Date(firstOfThisMonth.getTime() - 1)
  const firstOfLastMonth = new Date(lastOfLastMonth.getFullYear(), lastOfLastMonth.getMonth(), 1)
  return { from: toISO(firstOfLastMonth), to: toISO(lastOfLastMonth) }
}

// ── Preset definitions ─────────────────────────────────────────
type Preset = "today" | "3days" | "last_month" | "custom"

const PRESETS: { value: Preset; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "3days", label: "Last 3 days" },
  { value: "last_month", label: "Last month" },
  { value: "custom", label: "Custom" },
]

function presetDates(preset: Preset, customFrom: string, customTo: string) {
  switch (preset) {
    case "today":      return { from: today(), to: today() }
    case "3days":      return { from: lastN(3), to: today() }
    case "last_month": return lastMonthRange()
    case "custom":     return { from: customFrom, to: customTo }
  }
}

// ── Misc helpers ───────────────────────────────────────────────
const paymentLabel: Record<string, string> = {
  cash: "Cash", upi: "UPI", card: "Card", credit: "Credit",
}

function shortDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" })
}

// ── Stat card ──────────────────────────────────────────────────
function StatCard({
  title, value, sub, icon: Icon, highlight,
}: {
  title: string; value: string; sub?: string
  icon: React.ElementType; highlight?: "positive" | "negative"
}) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground font-medium">{title}</p>
            <p className={`text-2xl font-bold tracking-tight truncate mt-0.5 ${
              highlight === "positive" ? "text-green-600"
              : highlight === "negative" ? "text-destructive"
              : ""
            }`}>
              {value}
            </p>
            {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
          </div>
          <div className="rounded-lg bg-primary/10 p-2 shrink-0 mt-0.5">
            <Icon className="size-4 text-primary" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function StatSkeleton() {
  return (
    <Card><CardContent className="p-5 space-y-2">
      <Skeleton className="h-3 w-24" />
      <Skeleton className="h-7 w-32" />
      <Skeleton className="h-3 w-20" />
    </CardContent></Card>
  )
}

// ── Page ───────────────────────────────────────────────────────
export function DashboardPage() {
  const [preset, setPreset] = useState<Preset>("today")
  const [customFrom, setCustomFrom] = useState(today())
  const [customTo, setCustomTo] = useState(today())

  const { from, to } = presetDates(preset, customFrom, customTo)

  const { data, isLoading } = useQuery({
    queryKey: ["dashboard", from, to],
    queryFn: () => getDashboardSummary({ date_from: from, date_to: to }).then((r) => r.data),
    refetchInterval: 60_000,
    enabled: !!from && !!to,
  })

  const netPositive = (data?.net_profit ?? 0) >= 0
  const isSingleDay = from === to

  const periodLabel = isSingleDay
    ? shortDate(from)
    : `${shortDate(from)} – ${shortDate(to)}`

  return (
    <div className="p-4 sm:p-6 space-y-5">
      {/* ── Header + filter ───────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Dashboard</h2>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:flex-wrap">
          {/* Preset buttons */}
          <div className="grid grid-cols-2 overflow-hidden rounded-md border text-sm sm:flex">
            {PRESETS.map((p) => (
              <button
                key={p.value}
                onClick={() => setPreset(p.value)}
                className={`px-3 py-1.5 transition-colors ${
                  preset === p.value
                    ? "bg-primary text-primary-foreground"
                    : "bg-background text-muted-foreground hover:bg-muted"
                } ${p.value !== "today" ? "border-l" : ""} ${p.value === "custom" ? "col-span-2 sm:col-span-1" : ""}`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Custom date inputs */}
          {preset === "custom" && (
            <div className="grid grid-cols-1 gap-2 sm:flex sm:items-center sm:gap-1.5">
              <Input
                type="date"
                value={customFrom}
                max={customTo}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="h-8 w-36 text-sm"
              />
              <span className="hidden text-muted-foreground text-xs sm:inline">to</span>
              <Input
                type="date"
                value={customTo}
                min={customFrom}
                max={today()}
                onChange={(e) => setCustomTo(e.target.value)}
                className="h-8 w-36 text-sm"
              />
            </div>
          )}
        </div>
      </div>

      {/* ── Stat cards ────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <StatSkeleton key={i} />)
        ) : (
          <>
            <StatCard
              title="Revenue"
              value={currency(data?.period_revenue ?? 0)}
              sub={`${data?.period_invoice_count ?? 0} invoice${data?.period_invoice_count !== 1 ? "s" : ""} · ${periodLabel}`}
              icon={BadgeIndianRupee}
            />
            <StatCard
              title="Expenses"
              value={currency(data?.period_expenses ?? 0)}
              sub={periodLabel}
              icon={Wallet}
            />
            <StatCard
              title="Net Profit"
              value={currency(data?.net_profit ?? 0)}
              sub="Revenue − Expenses"
              icon={netPositive ? TrendingUp : TrendingDown}
              highlight={netPositive ? "positive" : "negative"}
            />
            <StatCard
              title="Low Stock Items"
              value={String(data?.low_stock_count ?? 0)}
              sub="Products below threshold"
              icon={AlertTriangle}
              highlight={
                (data?.low_stock_count ?? 0) === 0 ? undefined
                : (data?.low_stock_count ?? 0) >= 5 ? "negative"
                : "positive"
              }
            />
          </>
        )}
      </div>

      {/* ── Chart + Recent invoices ────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Sales trend */}
        <Card className="lg:col-span-3">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">
              Sales Trend
              <span className="ml-2 font-normal text-muted-foreground">{periodLabel}</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-48 w-full" />
            ) : (data?.sales_trend ?? []).length <= 1 ? (
              /* Single day — show a simple big number instead of a pointless 1-dot chart */
              <div className="h-48 flex flex-col items-center justify-center gap-1">
                <p className="text-4xl font-bold">{currency(data?.period_revenue ?? 0)}</p>
                <p className="text-sm text-muted-foreground">Total for {periodLabel}</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={data?.sales_trend} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={shortDate}
                    tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                    axisLine={false}
                    tickLine={false}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    tickFormatter={(v) => `₹${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`}
                    tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    formatter={(value) => [currency(Number(value ?? 0)), "Revenue"]}
                    labelFormatter={(l) => shortDate(l as string)}
                    contentStyle={{
                      background: "hsl(var(--popover))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                      fontSize: 12,
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    fill="url(#revenueGrad)"
                    dot={false}
                    activeDot={{ r: 4 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Recent invoices */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-semibold">Recent Invoices</CardTitle>
            <Link to="/app/invoices" className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
              View all <ArrowRight className="size-3" />
            </Link>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-4 space-y-3">
                {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
              </div>
            ) : (data?.recent_invoices.length ?? 0) === 0 ? (
              <p className="text-sm text-muted-foreground p-4">No invoices in this period.</p>
            ) : (
              <div className="divide-y">
                {data?.recent_invoices.map((inv) => (
                  <div key={inv.id} className="flex items-center justify-between gap-2 px-4 py-2.5">
                    <div className="min-w-0">
                      <p className="text-xs font-mono font-medium">{inv.invoice_number}</p>
                      <p className="text-xs text-muted-foreground truncate">{inv.customer_name}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs font-semibold">{currency(inv.total)}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {paymentLabel[inv.payment_method] ?? inv.payment_method}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Low stock ──────────────────────────────────── */}
      {(isLoading || (data?.low_stock_count ?? 0) > 0) && (
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="size-4 text-amber-500" />
              <CardTitle className="text-sm font-semibold">Low Stock</CardTitle>
              {!isLoading && (
                <Badge variant="secondary" className="text-amber-600 bg-amber-50 border-amber-200">
                  {data?.low_stock_count} item{data?.low_stock_count !== 1 ? "s" : ""}
                </Badge>
              )}
            </div>
            <Link to="/app/products" className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
              Manage <ArrowRight className="size-3" />
            </Link>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-4 space-y-2">
                {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}
              </div>
            ) : (
              <div className="divide-y">
                {data?.low_stock_products.map((p) => (
                  <div key={p.id} className="flex items-center justify-between gap-2 px-4 py-2.5">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{p.name}</p>
                      <p className="text-xs text-muted-foreground font-mono">{p.sku}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <span className={`text-sm font-semibold ${
                        p.current_stock === 0 ? "text-destructive" : "text-amber-600"
                      }`}>
                        {p.current_stock}
                      </span>
                      <p className="text-[11px] text-muted-foreground">/ {p.low_stock_threshold} min</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
