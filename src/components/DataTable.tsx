import React, { useState, useMemo } from 'react';

interface Column<T> {
  key: string;
  header: string;
  render?: (item: T, index: number) => React.ReactNode;
  sortable?: boolean;
  sortValue?: (item: T) => string | number;
}

interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  searchPlaceholder?: string;
  searchFields?: (keyof T | string)[];
  defaultSort?: { key: string; direction: 'asc' | 'desc' };
  exportFileName?: string;
  pageSize?: number;
}

export function DataTable<T>({
  data,
  columns,
  searchPlaceholder = 'Search records...',
  searchFields = [],
  defaultSort,
  exportFileName = 'table-export',
  pageSize = 10
}: DataTableProps<T>) {
  // States
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(pageSize);
  
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(
    defaultSort || null
  );

  const [visibleColumns, setVisibleColumns] = useState<string[]>(() => 
    columns.map(c => c.key)
  );

  const [showColSelector, setShowColSelector] = useState(false);

  // 1. Filter Data
  const filteredData = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query || searchFields.length === 0) return data;

    return data.filter((item: any) => {
      return searchFields.some((field) => {
        const val = item[field];
        if (val === null || val === undefined) return false;
        return String(val).toLowerCase().includes(query);
      });
    });
  }, [data, searchQuery, searchFields]);

  // 2. Sort Data
  const sortedData = useMemo(() => {
    if (!sortConfig) return filteredData;

    const sorted = [...filteredData];
    const { key, direction } = sortConfig;
    const col = columns.find(c => c.key === key);

    sorted.sort((a: any, b: any) => {
      let valA = col?.sortValue ? col.sortValue(a) : a[key];
      let valB = col?.sortValue ? col.sortValue(b) : b[key];

      if (valA === undefined || valA === null) valA = '';
      if (valB === undefined || valB === null) valB = '';

      if (typeof valA === 'string') {
        return direction === 'asc' 
          ? valA.localeCompare(valB) 
          : valB.localeCompare(valA);
      } else {
        return direction === 'asc' 
          ? (valA as number) - (valB as number) 
          : (valB as number) - (valA as number);
      }
    });

    return sorted;
  }, [filteredData, sortConfig, columns]);

  // 3. Paginate Data
  const totalPages = Math.ceil(sortedData.length / itemsPerPage) || 1;
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return sortedData.slice(start, start + itemsPerPage);
  }, [sortedData, currentPage, itemsPerPage]);

  // Adjust page boundary if data shifts
  React.useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [totalPages, currentPage]);

  const handleSort = (key: string) => {
    const col = columns.find(c => c.key === key);
    if (!col || col.sortable === false) return;

    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
    setCurrentPage(1);
  };

  // CSV Export Helper
  const handleExportCSV = () => {
    if (sortedData.length === 0) return;

    // Build headers from visible columns
    const activeCols = columns.filter(c => visibleColumns.includes(c.key));
    const headers = activeCols.map(c => `"${c.header.replace(/"/g, '""')}"`).join(',');

    // Build rows
    const rows = sortedData.map((item: any) => {
      return activeCols.map((c) => {
        const val = colValToString(item, c);
        // Escape quotes
        return `"${val.replace(/"/g, '""')}"`;
      }).join(',');
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers, ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `${exportFileName}-${new Date().toISOString().substring(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const colValToString = (item: any, col: Column<T>): string => {
    if (col.sortValue) return String(col.sortValue(item));
    const rawVal = item[col.key];
    if (rawVal === undefined || rawVal === null) return '';
    if (typeof rawVal === 'object') return JSON.stringify(rawVal);
    return String(rawVal);
  };

  return (
    <div 
      className="data-table-container"
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-md)',
        boxShadow: 'var(--shadow-sm)',
        overflow: 'hidden',
        width: '100%'
      }}
    >
      {/* Table Actions Toolbar */}
      <div 
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 16px',
          borderBottom: '1px solid var(--border)',
          gap: '12px',
          flexWrap: 'wrap'
        }}
      >
        {/* Search Field */}
        <div style={{ position: 'relative', flex: 1, minWidth: '240px', maxWidth: '380px' }}>
          <input
            type="text"
            placeholder={searchPlaceholder}
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            style={{
              paddingLeft: '36px',
              height: '38px',
              fontSize: '13px'
            }}
          />
          <svg 
            width="14" 
            height="14" 
            viewBox="0 0 24 24" 
            fill="none" 
            stroke="var(--text-secondary)" 
            strokeWidth="2.5"
            style={{ position: 'absolute', left: '12px', top: '12px' }}
          >
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
        </div>

        {/* Column & Export Options */}
        <div style={{ display: 'flex', gap: '8px', position: 'relative' }}>
          {/* Column Visibility Selector Toggle */}
          <button
            onClick={() => setShowColSelector(!showColSelector)}
            style={{
              background: 'var(--bg-card)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)',
              padding: '6px 12px',
              fontSize: '12px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              minHeight: '36px',
              margin: 0
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"></path></svg>
            Columns
          </button>

          {/* Columns Selector Dropdown */}
          {showColSelector && (
            <div
              style={{
                position: 'absolute',
                top: '40px',
                right: '90px',
                background: 'var(--bg-card)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
                boxShadow: 'var(--shadow-lg)',
                padding: '10px',
                zIndex: 100,
                minWidth: '160px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px'
              }}
            >
              <div style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '4px' }}>Toggle Columns</div>
              {columns.map(c => (
                <label 
                  key={c.key} 
                  style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '8px', 
                    fontSize: '12px', 
                    margin: 0, 
                    fontWeight: 'normal',
                    cursor: 'pointer' 
                  }}
                >
                  <input
                    type="checkbox"
                    checked={visibleColumns.includes(c.key)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setVisibleColumns([...visibleColumns, c.key]);
                      } else {
                        if (visibleColumns.length > 1) {
                          setVisibleColumns(visibleColumns.filter(k => k !== c.key));
                        }
                      }
                    }}
                    style={{ width: 'auto', minHeight: 'auto', padding: 0 }}
                  />
                  <span>{c.header}</span>
                </label>
              ))}
            </div>
          )}

          {/* Export CSV Button */}
          <button
            onClick={handleExportCSV}
            style={{
              background: 'var(--bg-card)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)',
              padding: '6px 12px',
              fontSize: '12px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              minHeight: '36px',
              margin: 0
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
            Export
          </button>
        </div>
      </div>

      {/* Actual Data Table Responsive Wrapper */}
      <div style={{ overflowX: 'auto', width: '100%' }}>
        <table 
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            textAlign: 'left',
            fontSize: '13px'
          }}
        >
          <thead>
            <tr style={{ background: 'var(--bg-table-hdr)', borderBottom: '1px solid var(--border)' }}>
              {columns
                .filter(c => visibleColumns.includes(c.key))
                .map((col) => (
                  <th
                    key={col.key}
                    onClick={() => handleSort(col.key)}
                    style={{
                      padding: '6px 10px',
                      fontWeight: '600',
                      color: 'var(--text-secondary)',
                      cursor: col.sortable !== false ? 'pointer' : 'default',
                      userSelect: 'none',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span>{col.header}</span>
                      {col.sortable !== false && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', color: 'var(--text-secondary)' }}>
                          {sortConfig?.key === col.key ? (
                            sortConfig.direction === 'asc' ? (
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" style={{ marginLeft: '4px' }}>
                                <path d="M18 15l-6-6-6 6" strokeLinecap="round" strokeLinejoin="round"/>
                              </svg>
                            ) : (
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" style={{ marginLeft: '4px' }}>
                                <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round"/>
                              </svg>
                            )
                          ) : (
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" style={{ marginLeft: '4px', opacity: 0.5 }}>
                              <path d="M7 15l5 5 5-5M7 9l5-5 5 5" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          )}
                        </span>
                      )}
                    </div>
                  </th>
                ))}
            </tr>
          </thead>
          <tbody>
            {paginatedData.map((item, rowIdx) => (
              <tr 
                key={rowIdx}
                style={{ 
                  borderBottom: '1px solid var(--border)',
                  background: 'var(--bg-card)',
                  transition: 'background-color 150ms ease'
                }}
                className="table-row-hover"
              >
                {columns
                  .filter(c => visibleColumns.includes(c.key))
                  .map((col) => (
                    <td 
                      key={col.key}
                      style={{
                        padding: '6px 10px',
                        color: 'var(--text-primary)',
                        verticalAlign: 'middle'
                      }}
                    >
                      {col.render ? col.render(item, (currentPage - 1) * itemsPerPage + rowIdx) : (item as any)[col.key]}
                    </td>
                  ))}
              </tr>
            ))}
            {filteredData.length === 0 && (
              <tr>
                <td 
                  colSpan={columns.filter(c => visibleColumns.includes(c.key)).length}
                  style={{
                    padding: '32px',
                    textAlign: 'center',
                    color: 'var(--text-secondary)'
                  }}
                >
                  No records found matching search query.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 16px',
          borderTop: '1px solid var(--border)',
          gap: '12px',
          flexWrap: 'wrap',
          background: 'var(--bg-table-hdr)'
        }}
      >
        <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
          Showing{' '}
          <span style={{ fontWeight: '700', color: 'var(--text-primary)' }}>
            {filteredData.length === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1}
          </span>{' '}
          to{' '}
          <span style={{ fontWeight: '700', color: 'var(--text-primary)' }}>
            {Math.min(currentPage * itemsPerPage, filteredData.length)}
          </span>{' '}
          of{' '}
          <span style={{ fontWeight: '700', color: 'var(--text-primary)' }}>
            {filteredData.length}
          </span>{' '}
          entries
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {/* Items Per Page Select */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}>
            <span style={{ color: 'var(--text-secondary)' }}>Rows:</span>
            <select
              value={itemsPerPage}
              onChange={(e) => {
                setItemsPerPage(Number(e.target.value));
                setCurrentPage(1);
              }}
              style={{
                width: '60px',
                padding: '4px',
                minHeight: '28px',
                fontSize: '12px'
              }}
            >
              {[10, 25, 50, 100].map(size => (
                <option key={size} value={size}>{size}</option>
              ))}
            </select>
          </div>

          {/* Page buttons */}
          <div style={{ display: 'flex', gap: '4px' }}>
            <button
              onClick={() => setCurrentPage(1)}
              disabled={currentPage === 1}
              style={{
                padding: '4px 8px',
                minHeight: '28px',
                fontSize: '11px',
                cursor: 'pointer',
                margin: 0,
                border: '1px solid var(--border)',
                background: 'var(--bg-card)'
              }}
            >
              &larr; First
            </button>
            <button
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              style={{
                padding: '4px 8px',
                minHeight: '28px',
                fontSize: '11px',
                cursor: 'pointer',
                margin: 0,
                border: '1px solid var(--border)',
                background: 'var(--bg-card)'
              }}
            >
              Prev
            </button>
            <span style={{ display: 'flex', alignItems: 'center', padding: '0 8px', fontSize: '12px', fontWeight: '600' }}>
              {currentPage} / {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages}
              style={{
                padding: '4px 8px',
                minHeight: '28px',
                fontSize: '11px',
                cursor: 'pointer',
                margin: 0,
                border: '1px solid var(--border)',
                background: 'var(--bg-card)'
              }}
            >
              Next
            </button>
            <button
              onClick={() => setCurrentPage(totalPages)}
              disabled={currentPage === totalPages}
              style={{
                padding: '4px 8px',
                minHeight: '28px',
                fontSize: '11px',
                cursor: 'pointer',
                margin: 0,
                border: '1px solid var(--border)',
                background: 'var(--bg-card)'
              }}
            >
              Last &rarr;
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
