"use client"

import { useEffect, useMemo, useState } from "react"
import { Search } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"

type ColumnDef<T = unknown> = {
  key: keyof T | string
  header: string
  className?: string
  cell?: (row: T) => React.ReactNode
}

type PaginatedTableProps<T = unknown> = {
  data: T[]
  columns: ColumnDef<T>[]
  isLoading?: boolean
  emptyMessage?: string
  pageSize?: number
  searchPlaceholder?: string
  searchKeys?: (keyof T)[]
  rowHref?: (row: T) => string
  onRowClick?: (row: T) => void
  className?: string
  headerClassName?: string
  tableClassName?: string
  paginationClassName?: string
}

export function PaginatedTable<T>({
  data,
  columns,
  isLoading = false,
  emptyMessage = "No items found.",
  pageSize = 10,
  searchPlaceholder = "Search...",
  searchKeys,
  rowHref,
  onRowClick,
  className = "",
  headerClassName = "",
  tableClassName = "",
  paginationClassName = "",
}: PaginatedTableProps<T>) {
  const [searchQuery, setSearchQuery] = useState("")
  const [page, setPage] = useState(1)

  const filteredData = useMemo(() => {
    if (!searchQuery.trim()) return data
    const q = searchQuery.trim().toLowerCase()
    const keys = searchKeys || (Object.keys(data[0] || {}) as (keyof T)[])
    return data.filter((item) =>
      keys.some((key) => {
        const value = item[key]
        return typeof value === "string" && value.toLowerCase().includes(q)
      })
    )
  }, [data, searchQuery, searchKeys])

  const totalPages = Math.max(1, Math.ceil(filteredData.length / pageSize))
  const safePage = Math.min(Math.max(1, page), totalPages)
  const startIndex = (safePage - 1) * pageSize
  const endIndexExclusive = Math.min(startIndex + pageSize, filteredData.length)
  const pageItems = filteredData.slice(startIndex, endIndexExclusive)

  // Reset page when search changes
  useEffect(() => {
    setPage(1)
  }, [searchQuery])

  // Clamp page when data changes
  useMemo(() => {
    if (safePage !== page) setPage(safePage)
  }, [safePage, page])

  const renderCell = (row: T, column: ColumnDef<T>) => {
    if (column.cell) return column.cell(row)
    const value = row[column.key as keyof T]
    return typeof value === "string" || typeof value === "number" ? String(value) : null
  }

  if (isLoading) {
    return (
      <div
        className={`dark:bg-background rounded-lg border border-gray-200 bg-white dark:border-gray-700 ${className}`}
      >
        <div className="border-b border-gray-200 p-4 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <Skeleton className="h-5 w-32 bg-gray-200/70 dark:bg-gray-800" />
            <Skeleton className="h-9 w-64 bg-gray-200/70 dark:bg-gray-800" />
          </div>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-b border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800">
                {columns.map((col) => (
                  <TableHead
                    key={String(col.key)}
                    className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase dark:text-gray-400"
                  >
                    {col.header}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {[...Array(pageSize)].map((_, i) => (
                <TableRow key={i}>
                  {columns.map((col) => (
                    <TableCell key={String(col.key)} className="px-6 py-4">
                      <Skeleton className="h-4 w-full bg-gray-200/60 dark:bg-gray-800" />
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    )
  }

  return (
    <div className={`dark:bg-background rounded-lg border border-gray-200 bg-white dark:border-gray-700 ${className}`}>
      {/* Header with count and search */}
      <div className={`border-b border-gray-200 p-4 dark:border-gray-700 ${headerClassName}`}>
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-600 dark:text-gray-400">
            {filteredData.length} item{filteredData.length === 1 ? "" : "s"}
          </div>
          <div className="relative">
            <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <Input
              type="text"
              placeholder={searchPlaceholder}
              className="h-9 w-64 border-gray-200 bg-gray-50 pl-9 dark:border-gray-600 dark:bg-gray-800"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className={`overflow-x-auto ${tableClassName}`}>
        <Table>
          <TableHeader>
            <TableRow className="border-b border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800">
              {columns.map((col) => (
                <TableHead
                  key={String(col.key)}
                  className={`px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase dark:text-gray-400 ${col.className || ""}`}
                >
                  {col.header}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {pageItems.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="text-muted-foreground py-8 text-center text-sm">
                  {emptyMessage}
                </TableCell>
              </TableRow>
            ) : (
              pageItems.map((row, idx) => {
                const isClickable = rowHref || onRowClick
                return (
                  <TableRow
                    key={idx}
                    className={
                      isClickable ? "cursor-pointer transition-colors hover:bg-gray-50 dark:hover:bg-gray-800" : ""
                    }
                    onClick={(event) => {
                      if (event.defaultPrevented) return
                      const target = event.target as HTMLElement | null
                      if (target?.closest("[data-row-action]")) return
                      if (rowHref) {
                        // Use window.location for external navigation to avoid React Router issues
                        window.location.href = rowHref(row)
                      } else if (onRowClick) {
                        onRowClick(row)
                      }
                    }}
                  >
                    {columns.map((col) => (
                      <TableCell key={String(col.key)} className={`px-6 py-4 ${col.className || ""}`}>
                        {renderCell(row, col)}
                      </TableCell>
                    ))}
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className={`flex items-center justify-between border-t px-4 py-3 sm:px-6 ${paginationClassName}`}>
          <div className="hidden sm:block">
            <p className="text-muted-foreground text-sm">
              Showing{" "}
              <span className="text-foreground font-medium">{filteredData.length === 0 ? 0 : startIndex + 1}</span> to{" "}
              <span className="text-foreground font-medium">{endIndexExclusive}</span> of{" "}
              <span className="text-foreground font-medium">{filteredData.length}</span> results
            </p>
          </div>

          <div className="ml-auto flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={filteredData.length === 0 || safePage <= 1}
              onClick={() => setPage(safePage - 1)}
            >
              Prev
            </Button>

            <div className="hidden items-center gap-1 sm:flex">
              {Array.from({ length: totalPages }).map((_, i) => {
                const p = i + 1
                const active = p === safePage
                return (
                  <Button
                    key={`page-${p}`}
                    variant="outline"
                    size="sm"
                    disabled={filteredData.length === 0}
                    className={active ? "border-primary bg-primary/10 text-primary" : ""}
                    onClick={() => setPage(p)}
                  >
                    {p}
                  </Button>
                )
              })}
            </div>

            <Button
              variant="outline"
              size="sm"
              disabled={filteredData.length === 0 || safePage >= totalPages}
              onClick={() => setPage(safePage + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
