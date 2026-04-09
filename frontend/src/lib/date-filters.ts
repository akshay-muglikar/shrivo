export type DatePreset = "all" | "today" | "7d" | "1m" | "custom"

function pad(value: number) {
  return String(value).padStart(2, "0")
}

export function toDateInput(value: Date) {
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`
}

export function resolveDateRange(
  preset: DatePreset,
  customStartDate: string,
  customEndDate: string,
) {
  const today = new Date()

  if (preset === "today") {
    const formatted = toDateInput(today)
    return { startDate: formatted, endDate: formatted }
  }

  if (preset === "7d") {
    const start = new Date(today)
    start.setDate(start.getDate() - 6)
    return { startDate: toDateInput(start), endDate: toDateInput(today) }
  }

  if (preset === "1m") {
    const start = new Date(today)
    start.setMonth(start.getMonth() - 1)
    return { startDate: toDateInput(start), endDate: toDateInput(today) }
  }

  if (preset === "custom") {
    return {
      startDate: customStartDate || undefined,
      endDate: customEndDate || undefined,
    }
  }

  return { startDate: undefined, endDate: undefined }
}