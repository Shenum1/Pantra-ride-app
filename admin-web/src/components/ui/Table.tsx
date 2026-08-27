import { Fragment } from 'react';
import { ChevronDown, ChevronUp, ChevronLeft, ChevronRight } from 'lucide-react';
import { TableSkeleton } from './Skeleton';
import { EmptyState } from './EmptyState';

export interface TableColumn<T> {
  key: string;
  header: string;
  align?: 'left' | 'right';
  className?: string;
  render: (row: T) => React.ReactNode;
}

interface PaginationInfo {
  from: number;
  to: number;
  total: number;
  limit: number;
  onPrev: () => void;
  onNext: () => void;
}

interface TableProps<T> {
  columns: TableColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  loading?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  onRowClick?: (row: T) => void;
  expandedKey?: string | null;
  renderExpanded?: (row: T) => React.ReactNode;
  countLabel?: string;
  pagination?: PaginationInfo;
}

// The one table shell for the app — replaces the ~10 hand-copied
// filter-row/<table>/pagination blocks that used to be pasted per page.
export function Table<T>({
  columns,
  rows,
  rowKey,
  loading,
  emptyTitle = 'No results',
  emptyDescription,
  onRowClick,
  expandedKey,
  renderExpanded,
  countLabel,
  pagination,
}: TableProps<T>) {
  const expandable = expandedKey !== undefined && !!renderExpanded;
  const colSpan = columns.length + (expandable ? 1 : 0);

  return (
    <div className="overflow-hidden rounded-md border border-slate-200 bg-white">
      {countLabel && (
        <div className="border-b border-slate-100 px-5 py-3 text-sm text-slate-500">
          {loading ? 'Loading…' : countLabel}
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left">
              {expandable && <th className="w-8" />}
              {columns.map((c) => (
                <th
                  key={c.key}
                  className={`px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400 ${
                    c.align === 'right' ? 'text-right' : 'text-left'
                  } ${c.className ?? ''}`}
                >
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <TableSkeleton rows={6} cols={colSpan} />
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={colSpan} className="p-0">
                  <EmptyState title={emptyTitle} description={emptyDescription} />
                </td>
              </tr>
            ) : (
              rows.map((row) => {
                const key = rowKey(row);
                const isOpen = expandable && expandedKey === key;
                return (
                  <Fragment key={key}>
                    <tr
                      onClick={() => onRowClick?.(row)}
                      className={`${onRowClick ? 'cursor-pointer' : ''} transition-colors hover:bg-slate-50`}
                    >
                      {expandable && (
                        <td className="px-2 text-slate-400">
                          {isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        </td>
                      )}
                      {columns.map((c) => (
                        <td key={c.key} className={`px-4 py-3 ${c.align === 'right' ? 'text-right' : ''} ${c.className ?? ''}`}>
                          {c.render(row)}
                        </td>
                      ))}
                    </tr>
                    {isOpen && renderExpanded && (
                      <tr>
                        <td colSpan={colSpan} className="bg-slate-50 px-8 py-5">
                          {renderExpanded(row)}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {pagination && pagination.total > pagination.limit && (
        <div className="flex items-center justify-between border-t border-slate-100 px-5 py-3.5">
          <span className="text-sm text-slate-500">
            {pagination.from}–{pagination.to} of {pagination.total.toLocaleString()}
          </span>
          <div className="flex gap-2">
            <button
              onClick={pagination.onPrev}
              disabled={pagination.from <= 1}
              className="rounded-md border border-slate-200 p-2 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              onClick={pagination.onNext}
              disabled={pagination.to >= pagination.total}
              className="rounded-md border border-slate-200 p-2 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
