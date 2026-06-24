import React, { useState, useRef, useEffect } from 'react';
import type { LineItem, LineItemPreset, ChipGroup } from '../types/LineItem';
import '../styles/LineItemsEditor.css';

// ─── Props ────────────────────────────────────────────────────────────────────

interface LineItemsEditorProps {
  /** Controlled list of line items */
  items: LineItem[];
  /** Called whenever the item list changes (add / remove) */
  onChange: (items: LineItem[]) => void;

  // ── Preset mode ─────────────────────────────────────────────
  /**
   * 'chips'        — Quotation mode: chip buttons that fill the product name only
   * 'autocomplete' — Booking mode: type-ahead dropdown that fills name + desc + rate
   */
  presetMode?: 'chips' | 'autocomplete';

  /** Chip groups rendered above the form (used when presetMode='chips') */
  chipGroups?: ChipGroup[];

  /** Autocomplete presets (used when presetMode='autocomplete'); may include rate */
  presets?: LineItemPreset[];

  // ── GST feature (Quotation only) ────────────────────────────
  /** Show the "Rate Inc. GST" checkbox next to the Rate label */
  showGstCheckbox?: boolean;
  /** Active GST percentage (used to back-calc the rate when rateIncGst is checked) */
  gstRate?: number;

  // ── Description layout ──────────────────────────────────────
  /**
   * 'inline'  — Quotation: description rendered in the same grid row as name/qty/rate
   * 'textarea'— Booking:  description rendered as a full-width textarea below the row
   * 'none'    — Disabled: no description field
   */
  descLayout?: 'inline' | 'textarea' | 'none';

  // ── IDs for focus management ─────────────────────────────────
  /** id placed on the product name input (used for post-add focus) */
  nameInputId?: string;
  /** id placed on the qty input (used for preset-chip focus) */
  qtyInputId?: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

export const LineItemsEditor: React.FC<LineItemsEditorProps> = ({
  items,
  onChange,
  presetMode = 'autocomplete',
  chipGroups = [],
  presets = [],
  showGstCheckbox = false,
  gstRate = 18,
  descLayout = 'textarea',
  nameInputId = 'lieNameInput',
  qtyInputId = 'lieQtyInput',
}) => {
  // ── Local form state ─────────────────────────────────────────
  const [pname, setPname]       = useState('');
  const [pdesc, setPdesc]       = useState('');
  const [qty, setQty]           = useState('1');
  const [rate, setRate]         = useState('');
  const [rateIncGst, setRateIncGst] = useState(false);

  // autocomplete
  const [showSuggestions, setShowSuggestions] = useState(false);
  const acRef = useRef<HTMLDivElement>(null);

  // ── Close autocomplete on outside click ──────────────────────
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (acRef.current && !acRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // ── Filtered suggestions ──────────────────────────────────────
  const filteredPresets = presets.filter(p =>
    pname.trim().length > 0 &&
    p.name.toLowerCase().includes(pname.toLowerCase().trim())
  );

  // ── Handlers ─────────────────────────────────────────────────

  const handleSelectPreset = (p: LineItemPreset) => {
    setPname(p.name);
    if (p.desc) setPdesc(p.desc);
    if (p.rate !== undefined) setRate(String(p.rate));
    setShowSuggestions(false);
    // Focus qty after preset selection
    const qtyEl = document.getElementById(qtyInputId);
    if (qtyEl) qtyEl.focus();
  };

  const handleChipClick = (name: string) => {
    setPname(name);
    setShowSuggestions(false);
    const qtyEl = document.getElementById(qtyInputId);
    if (qtyEl) qtyEl.focus();
  };

  const handleAddItem = (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    const parsedQty = parseFloat(qty);
    let parsedRate  = parseFloat(rate);

    if (!pname.trim() || isNaN(parsedQty) || isNaN(parsedRate) || parsedQty <= 0 || parsedRate < 0) {
      alert('Product Name, Qty (>0) and Rate (>=0) are required!');
      return;
    }

    // Back-calc rate if "Inc. GST" is checked
    if (showGstCheckbox && rateIncGst) {
      parsedRate = parsedRate / (1 + gstRate / 100);
      parsedRate = Math.round(parsedRate * 100) / 100;
    }

    const newItem: LineItem = {
      id: `li_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      name:   pname.trim(),
      desc:   pdesc.trim() || undefined,
      qty:    parsedQty,
      rate:   parsedRate,
      amount: Math.round(parsedQty * parsedRate * 100) / 100,
    };

    onChange([...items, newItem]);

    // Reset form
    setPname('');
    setPdesc('');
    setQty('1');
    setRate('');

    // Return focus to name input
    const nameEl = document.getElementById(nameInputId);
    if (nameEl) nameEl.focus();
  };

  const handleRemoveItem = (idx: number) => {
    const next = [...items];
    next.splice(idx, 1);
    onChange(next);
  };

  const subtotal = items.reduce((s, it) => s + it.amount, 0);

  // ── Render ────────────────────────────────────────────────────
  return (
    <div className="lie-wrapper">

      {/* ── Chip presets (Quotation mode) ── */}
      {presetMode === 'chips' && chipGroups.length > 0 && (
        <div>
          {chipGroups.map((group) => (
            <div key={group.label} className="lie-chip-group">
              <span className="lie-presets-label">{group.label}</span>
              <div className="lie-chips">
                {group.names.map((name) => (
                  <button
                    key={name}
                    type="button"
                    className={`lie-chip${group.chipClass ? ` ${group.chipClass}` : ''}`}
                    onClick={() => handleChipClick(name)}
                  >
                    {name}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Add Item Form ── */}
      <form className="lie-form" onSubmit={handleAddItem}>
        <div className="lie-add-row">

          {/* Product Name (with optional autocomplete) */}
          <div>
            <label className="lie-field-label" htmlFor={nameInputId}>Product Name *</label>
            <div className={presetMode === 'autocomplete' ? 'lie-autocomplete-wrap' : undefined} ref={presetMode === 'autocomplete' ? acRef : undefined}>
              <input
                id={nameInputId}
                className="lie-input"
                type="text"
                placeholder="Product / Component name"
                value={pname}
                autoComplete="off"
                onChange={(e) => {
                  setPname(e.target.value);
                  if (presetMode === 'autocomplete') setShowSuggestions(true);
                }}
                onFocus={() => {
                  if (presetMode === 'autocomplete') setShowSuggestions(true);
                }}
                required
              />
              {/* Autocomplete dropdown */}
              {presetMode === 'autocomplete' && showSuggestions && filteredPresets.length > 0 && (
                <div className="lie-autocomplete-list" role="listbox">
                  {filteredPresets.slice(0, 8).map((p, i) => (
                    <div
                      key={i}
                      className="lie-autocomplete-item"
                      role="option"
                      aria-selected={false}
                      onMouseDown={() => handleSelectPreset(p)}
                    >
                      <div className="lie-ac-main">{p.name}</div>
                      {(p.desc || p.rate !== undefined) && (
                        <div className="lie-ac-sub">
                          {p.desc}{p.desc && p.rate !== undefined ? ' · ' : ''}{p.rate !== undefined ? `₹${p.rate.toLocaleString('en-IN')}` : ''}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Description — inline (Quotation mode) */}
          {descLayout === 'inline' && (
            <div>
              <label className="lie-field-label">Description</label>
              <input
                className="lie-input"
                type="text"
                placeholder="Model, details, etc."
                value={pdesc}
                onChange={(e) => setPdesc(e.target.value)}
              />
            </div>
          )}

          {/* Qty */}
          <div>
            <label className="lie-field-label" htmlFor={qtyInputId}>Qty</label>
            <input
              id={qtyInputId}
              className="lie-input"
              type="number"
              placeholder="1"
              min="0.01"
              step="any"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              required
            />
          </div>

          {/* Rate */}
          <div>
            {showGstCheckbox ? (
              <div className="lie-rate-label-row">
                <label className="lie-field-label" style={{ margin: 0 }}>Rate (₹)</label>
                <label className="lie-gst-toggle">
                  <input
                    type="checkbox"
                    checked={rateIncGst}
                    onChange={(e) => setRateIncGst(e.target.checked)}
                  />
                  Inc. GST
                </label>
              </div>
            ) : (
              <label className="lie-field-label">Rate (₹)</label>
            )}
            <input
              className="lie-input"
              type="number"
              placeholder="0.00"
              min="0"
              step="0.01"
              value={rate}
              onChange={(e) => setRate(e.target.value)}
              required
            />
          </div>

          {/* Add Button */}
          <div className="lie-add-btn-wrap">
            <button type="submit" className="lie-add-btn" aria-label="Add item">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
                <line x1="12" y1="5" x2="12" y2="19"/>
                <line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
              Add
            </button>
          </div>
        </div>

        {/* Description — textarea below row (Booking mode) */}
        {descLayout === 'textarea' && (
          <div className="lie-desc-below" style={{ marginTop: '12px' }}>
            <label className="lie-field-label">Description / Specifications</label>
            <textarea
              className="lie-textarea"
              placeholder="e.g. Capacity: 500kg/hr, Motor: 3HP, Single Phase"
              value={pdesc}
              onChange={(e) => setPdesc(e.target.value)}
            />
          </div>
        )}
      </form>

      {/* ── Items Table ── */}
      {items.length > 0 ? (
        <div className="lie-table-wrap">
          <table className="lie-table" aria-label="Line items">
            <thead>
              <tr>
                <th style={{ width: 44 }} className="center">#</th>
                <th>Item Details</th>
                <th style={{ width: 72 }} className="center">Qty</th>
                <th style={{ width: 115 }} className="right">Rate</th>
                <th style={{ width: 125 }} className="right">Amount</th>
                <th style={{ width: 46 }} className="center" aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {items.map((it, idx) => (
                <tr key={it.id || `${it.name}_${idx}`}>
                  <td className="center" style={{ color: 'var(--text-muted)', fontSize: '12px' }}>
                    {idx + 1}
                  </td>
                  <td>
                    <div className="lie-item-name">{it.name}</div>
                    {descLayout !== 'none' && it.desc && <div className="lie-item-desc">{it.desc}</div>}
                  </td>
                  <td className="center">{it.qty}</td>
                  <td className="right">₹{it.rate.toLocaleString('en-IN')}</td>
                  <td className="right">₹{it.amount.toLocaleString('en-IN')}</td>
                  <td className="center">
                    <button
                      type="button"
                      className="lie-del-btn"
                      onClick={() => handleRemoveItem(idx)}
                      aria-label={`Remove ${it.name}`}
                      title="Remove item"
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <polyline points="3 6 5 6 21 6"/>
                        <path d="M19 6l-1 14H6L5 6"/>
                        <path d="M10 11v6"/><path d="M14 11v6"/>
                        <path d="M9 6V4h6v2"/>
                      </svg>
                    </button>
                  </td>
                </tr>
              ))}
              {/* Subtotal row */}
              <tr className="lie-subtotal-row">
                <td colSpan={3} />
                <td className="lie-subtotal-label">Subtotal</td>
                <td className="lie-subtotal-amount">
                  ₹{subtotal.toLocaleString('en-IN')}
                </td>
                <td />
              </tr>
            </tbody>
          </table>
        </div>
      ) : (
        <div className="lie-empty" aria-live="polite">
          No items added yet — use the form above to add products.
        </div>
      )}
    </div>
  );
};

export default LineItemsEditor;
