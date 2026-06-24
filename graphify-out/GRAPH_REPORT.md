# Graph Report - react-migration  (2026-06-20)

## Corpus Check
- 61 files · ~74,417 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 277 nodes · 624 edges · 13 communities (12 shown, 1 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 8|Community 8]]
- [[_COMMUNITY_Community 9|Community 9]]
- [[_COMMUNITY_Community 10|Community 10]]

## God Nodes (most connected - your core abstractions)
1. `formatCurrency()` - 21 edges
2. `Booking` - 20 edges
3. `compilerOptions` - 17 edges
4. `compilerOptions` - 16 edges
5. `useAuth()` - 13 edges
6. `getFiscalYear()` - 12 edges
7. `Customer` - 11 edges
8. `BookingRepository` - 10 edges
9. `Modal()` - 9 edges
10. `Quotation` - 9 edges

## Surprising Connections (you probably didn't know these)
- `QuotationPreviewProps` --references--> `Quotation`  [EXTRACTED]
  src/components/QuotationPreview.tsx → src/repositories/QuotationRepository.ts
- `CustomerFormProps` --references--> `Customer`  [EXTRACTED]
  src/pages/CustomerForm.tsx → src/repositories/CustomerRepository.ts
- `BookingModernPreviewProps` --references--> `Booking`  [EXTRACTED]
  src/components/BookingModernPreview.tsx → src/repositories/BookingRepository.ts
- `BookingPreviewProps` --references--> `Booking`  [EXTRACTED]
  src/components/BookingPreview.tsx → src/repositories/BookingRepository.ts
- `BookingPreview()` --calls--> `numberToWords()`  [EXTRACTED]
  src/components/BookingPreview.tsx → src/utils/numberToWords.ts

## Import Cycles
- None detected.

## Communities (13 total, 1 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.14
Nodes (32): BookingModernPreview(), BookingModernPreviewProps, BookingPreview(), BookingPreviewProps, BookingThermalPreview(), BookingThermalPreviewProps, Button(), ButtonProps (+24 more)

### Community 1 - "Community 1"
Cohesion: 0.07
Nodes (27): ErrorBoundary, Props, State, MobileNav(), MobileNavProps, ProtectedRoute(), ProtectedRouteProps, Sidebar() (+19 more)

### Community 2 - "Community 2"
Cohesion: 0.12
Nodes (21): supabase, useCustomers(), CustomersPage(), Customer, CustomerRepository, Quotation, QuotationRepository, clearSyncQueue() (+13 more)

### Community 3 - "Community 3"
Cohesion: 0.06
Nodes (34): dependencies, framer-motion, html2canvas, jspdf, qrcode, react, react-dom, react-router-dom (+26 more)

### Community 4 - "Community 4"
Cohesion: 0.11
Nodes (26): AadhaarInput(), FormGroup(), FormGroupProps, GstinInput(), Input(), InputProps, MobileInput(), Select() (+18 more)

### Community 5 - "Community 5"
Cohesion: 0.12
Nodes (13): Header(), HeaderProps, QuotationPreview(), QuotationPreviewProps, MONTH_NAMES, MONTH_SHORT, PendingDeliveriesPage(), SortKey (+5 more)

### Community 6 - "Community 6"
Cohesion: 0.11
Nodes (18): compilerOptions, allowImportingTsExtensions, erasableSyntaxOnly, jsx, lib, module, moduleDetection, moduleResolution (+10 more)

### Community 7 - "Community 7"
Cohesion: 0.11
Nodes (17): compilerOptions, allowImportingTsExtensions, erasableSyntaxOnly, lib, module, moduleDetection, moduleResolution, noEmit (+9 more)

### Community 8 - "Community 8"
Cohesion: 0.38
Nodes (9): envPath, main(), migrateBookings(), migrateCustomers(), migrateQuotations(), migrateSequences(), pullOldPayload(), stats (+1 more)

### Community 9 - "Community 9"
Cohesion: 0.50
Nodes (3): Expanding the ESLint configuration, React Compiler, React + TypeScript + Vite

## Knowledge Gaps
- **106 isolated node(s):** `name`, `private`, `version`, `type`, `dev` (+101 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **1 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Booking` connect `Community 0` to `Community 1`, `Community 2`, `Community 5`?**
  _High betweenness centrality (0.020) - this node is a cross-community bridge._
- **Why does `formatCurrency()` connect `Community 0` to `Community 1`, `Community 2`, `Community 4`, `Community 5`?**
  _High betweenness centrality (0.016) - this node is a cross-community bridge._
- **What connects `name`, `private`, `version` to the rest of the system?**
  _106 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.13795918367346938 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.06871035940803383 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.11740890688259109 - nodes in this community are weakly interconnected._
- **Should `Community 3` be split into smaller, more focused modules?**
  _Cohesion score 0.05714285714285714 - nodes in this community are weakly interconnected._