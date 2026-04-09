import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Edit, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { PaginationControls } from "@/components/pagination-controls"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { resolveDateRange, toDateInput, type DatePreset } from "@/lib/date-filters"
import { currency, date } from "@/lib/formatters"
import { getExpenses, type Expense } from "../api/expenses.api"
import { AddExpenseSheet } from "../components/AddExpenseSheet"

export function ExpensesPage() {
  const [search, setSearch] = useState("")
  const [createOpen, setCreateOpen] = useState(false)
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null)
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(20)
  const [datePreset, setDatePreset] = useState<DatePreset>("all")
  const [customStartDate, setCustomStartDate] = useState("")
  const [customEndDate, setCustomEndDate] = useState(toDateInput(new Date()))

  const { startDate, endDate } = resolveDateRange(datePreset, customStartDate, customEndDate)

  const { data, isLoading } = useQuery({
    queryKey: ["expenses", search, page, limit, startDate, endDate],
    queryFn: () => getExpenses({
      search: search || undefined,
      start_date: startDate,
      end_date: endDate,
      page, limit,
    }).then((r) => r.data),
  })

  const totalAmount = (data?.items ?? []).reduce((sum, e) => sum + Number(e.amount), 0)

  return (
    <>
      <AddExpenseSheet
        open={createOpen}
        onOpenChange={(open) => { setCreateOpen(open); if (!open) setEditingExpense(null) }}
        expense={editingExpense}
      />

      <div className="p-4 sm:p-6 space-y-4">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold">Expenses</h2>
            <p className="text-sm text-muted-foreground hidden sm:block">Track day-to-day operational costs.</p>
          </div>
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="size-4" />
            <span className="hidden sm:inline">Add Expense</span>
            <span className="sm:hidden">Add</span>
          </Button>
        </div>

        {/* Filters */}
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <Input
            placeholder="Search expenses…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            className="w-full sm:max-w-xs"
          />
          <Select value={datePreset} onValueChange={(v) => { setDatePreset(v as DatePreset); setPage(1) }}>
            <SelectTrigger className="w-full sm:w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All dates</SelectItem>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="1m">Last month</SelectItem>
              <SelectItem value="custom">Custom</SelectItem>
            </SelectContent>
          </Select>
          {datePreset === "custom" && (
            <div className="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap">
              <Input type="date" value={customStartDate} onChange={(e) => { setCustomStartDate(e.target.value); setPage(1) }} className="w-full sm:w-36" />
              <Input type="date" value={customEndDate} onChange={(e) => { setCustomEndDate(e.target.value); setPage(1) }} className="w-full sm:w-36" />
            </div>
          )}
          <Card className="w-full sm:ml-auto sm:w-auto">
            <CardContent className="px-4 py-2 text-sm">
              <span className="text-muted-foreground">Page total: </span>{currency(totalAmount)}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead className="hidden sm:table-cell">Category</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead className="hidden sm:table-cell">Date</TableHead>
                  <TableHead className="hidden md:table-cell">Notes</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading && (
                  <TableRow>
                    <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">Loading…</TableCell>
                  </TableRow>
                )}
                {data?.items.map((expense) => (
                  <TableRow key={expense.id}>
                    <TableCell>
                      <div className="font-medium">{expense.title}</div>
                      <div className="text-xs text-muted-foreground sm:hidden">{date(expense.expense_date)}</div>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">{expense.category ?? "—"}</TableCell>
                    <TableCell className="font-medium">{currency(expense.amount)}</TableCell>
                    <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">{date(expense.expense_date)}</TableCell>
                    <TableCell className="hidden md:table-cell text-muted-foreground max-w-xs truncate">{expense.notes ?? "—"}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="outline" size="sm"
                        onClick={() => { setEditingExpense(expense); setCreateOpen(true) }}>
                        <Edit className="size-3.5" />
                        <span className="hidden sm:inline ml-1">Edit</span>
                        <span className="sm:hidden ml-1">Open</span>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {!isLoading && data?.items.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">No expenses found.</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
          {data && (
            <PaginationControls
              total={data.total} page={data.page} limit={data.limit}
              itemLabel="expenses" onPageChange={setPage}
              onLimitChange={(v) => { setLimit(v); setPage(1) }}
            />
          )}
        </Card>
      </div>
    </>
  )
}
