/**
 * One-time migration script: appdata JSON blobs → row-level relational tables.
 *
 * Usage:
 *   1. Run the SQL schema (src/config/supabaseSchema.sql) in your Supabase dashboard first.
 *   2. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env
 *   3. Run:  npx tsx scripts/migrateToRowLevel.ts
 *
 * This reads the existing `appdata` rows and inserts them into the new tables.
 * It is safe to re-run (uses upsert / ON CONFLICT for idempotency).
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

// ─── Load env vars from .env file ────────────────────────────
const envPath = path.resolve(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  envContent.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx > 0) {
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim();
      process.env[key] = val;
    }
  });
}

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

// ─── Helpers ─────────────────────────────────────────────────

async function pullOldPayload(id: string): Promise<{ data: any; deleted?: any[] } | null> {
  const { data, error } = await supabase
    .from('appdata')
    .select('payload')
    .eq('id', id);

  if (error || !data || data.length === 0) return null;
  return data[0].payload as { data: any; deleted?: any[] };
}

const stats = {
  customers: 0,
  quotations: 0,
  quotationLineItems: 0,
  bookings: 0,
  bookingLineItems: 0,
  payments: 0,
  auditLogs: 0,
};

// ─── Migrate Customers ───────────────────────────────────────

async function migrateCustomers() {
  console.log('\n📋 Migrating customers...');
  const payload = await pullOldPayload('customers');
  if (!payload) { console.log('  No customer data found.'); return; }

  const customers: any[] = payload.data || [];
  const deleted: string[] = payload.deleted || [];

  for (const c of customers) {
    const cname = (c.name || '').trim().toLowerCase();
    const cmobile = (c.mobile || '').replace(/\D/g, '');
    const ckey = `${cname}::${cmobile}`;
    const isDeleted = deleted.includes(ckey);

    const { error } = await supabase.from('customers').upsert({
      name: c.name,
      gender: c.gender || null,
      father: c.father || null,
      address: c.address || null,
      post: c.post || null,
      district: c.district || null,
      state: c.state || null,
      pincode: c.pincode || null,
      mobile: c.mobile || null,
      aadhar: c.aadhar || null,
      gstin: c.gstin || null,
      saved_at: c.savedAt || new Date().toISOString(),
      deleted_at: isDeleted ? new Date().toISOString() : null,
    }, { onConflict: 'name,mobile' });

    if (error) {
      console.error(`  ❌ Customer "${c.name}" failed:`, error.message);
    } else {
      stats.customers++;
    }
  }
  console.log(`  ✅ Migrated ${stats.customers} customers`);
}

// ─── Migrate Quotations ──────────────────────────────────────

async function migrateQuotations() {
  console.log('\n📄 Migrating quotations...');
  const payload = await pullOldPayload('history');
  if (!payload) { console.log('  No quotation data found.'); return; }

  const quotations: any[] = payload.data || [];
  const deleted: string[] = payload.deleted || [];

  for (const q of quotations) {
    if (!q.ref) continue;
    const isDeleted = deleted.includes(q.ref);

    // Upsert quotation row
    const { error: qError } = await supabase.from('quotations').upsert({
      ref: q.ref,
      date: q.date,
      date_val: q.dateVal,
      cust_name: q.custName,
      gender: q.gender,
      relation: q.relation,
      father_name: q.fatherName || null,
      address: q.address || null,
      post: q.post || null,
      district: q.district || null,
      state: q.state || null,
      pincode: q.pincode || null,
      mobile: q.mobile || null,
      aadhar: q.aadhar || null,
      heading: q.heading || '',
      hsn: q.hsn || null,
      capacity: q.capacity || null,
      power: q.power || null,
      discount: q.discount || 0,
      gst_rate: q.gstRate || 0,
      inc_inst: q.incInst || false,
      grand_total: q.grandTotal || 0,
      grand_total_fmt: q.grandTotalFmt || '',
      saved_at: q.savedAt || new Date().toISOString(),
      deleted_at: isDeleted ? new Date().toISOString() : null,
    });

    if (qError) {
      console.error(`  ❌ Quotation "${q.ref}" failed:`, qError.message);
      continue;
    }
    stats.quotations++;

    // Delete existing line items (idempotent re-run)
    await supabase.from('quotation_line_items').delete().eq('quotation_ref', q.ref);

    // Insert line items
    if (q.items && q.items.length > 0) {
      const lineItems = q.items.map((item: any, idx: number) => ({
        quotation_ref: q.ref,
        sort_order: idx,
        name: item.name || '',
        description: item.desc || null,
        qty: item.qty || 1,
        rate: item.rate || 0,
        amount: item.amount || 0,
      }));

      const { error: liError } = await supabase.from('quotation_line_items').insert(lineItems);
      if (liError) {
        console.error(`  ❌ Line items for "${q.ref}" failed:`, liError.message);
      } else {
        stats.quotationLineItems += lineItems.length;
      }
    }
  }
  console.log(`  ✅ Migrated ${stats.quotations} quotations, ${stats.quotationLineItems} line items`);
}

// ─── Migrate Bookings ────────────────────────────────────────

async function migrateBookings() {
  console.log('\n📦 Migrating bookings...');
  const payload = await pullOldPayload('bookings');
  if (!payload) { console.log('  No booking data found.'); return; }

  const bookings: any[] = payload.data || [];
  const deleted: string[] = payload.deleted || [];

  for (const b of bookings) {
    if (!b.bookingId) continue;
    const isDeleted = deleted.includes(b.bookingId);

    // Upsert booking row
    const { error: bError } = await supabase.from('bookings').upsert({
      booking_id: b.bookingId,
      booking_date: b.bookingDate,
      delivery_date: b.deliveryDate || null,
      cust_name: b.custName,
      cust_gender: b.custGender,
      relation: b.relation || null,
      father_name: b.fatherName || null,
      address: b.address || null,
      post: b.post || null,
      district: b.district || null,
      state: b.state || null,
      pincode: b.pincode || null,
      mobile: b.mobile || null,
      aadhar: b.aadhar || null,
      original_price: b.originalPrice || 0,
      additional_charges: b.additionalCharges || 0,
      discount: b.discount || 0,
      total_amount: b.totalAmount || 0,
      advance_paid: b.advancePaid || 0,
      payment_mode: b.paymentMode || 'None',
      balance_due: b.balanceDue || 0,
      payment_status: b.paymentStatus || 'No Advance',
      accessories: b.accessories || null,
      notes: b.notes || null,
      status: b.status || 'Pending',
      saved_at: b.savedAt || new Date().toISOString(),
      deleted_at: isDeleted ? new Date().toISOString() : null,
    });

    if (bError) {
      console.error(`  ❌ Booking "${b.bookingId}" failed:`, bError.message);
      continue;
    }
    stats.bookings++;

    // Delete existing children (idempotent re-run)
    await supabase.from('booking_line_items').delete().eq('booking_id', b.bookingId);
    await supabase.from('payments').delete().eq('booking_id', b.bookingId);
    await supabase.from('audit_logs').delete().eq('booking_id', b.bookingId);

    // Insert line items
    if (b.items && b.items.length > 0) {
      const lineItems = b.items.map((item: any, idx: number) => ({
        booking_id: b.bookingId,
        sort_order: idx,
        name: item.name || '',
        description: item.desc || null,
        qty: item.qty || 1,
        rate: item.rate || 0,
        amount: item.amount || 0,
      }));
      const { error } = await supabase.from('booking_line_items').insert(lineItems);
      if (error) console.error(`  ⚠️ Line items for "${b.bookingId}":`, error.message);
      else stats.bookingLineItems += lineItems.length;
    }

    // Insert payments
    if (b.payments && b.payments.length > 0) {
      const payments = b.payments.map((p: any) => ({
        id: p.id,
        booking_id: b.bookingId,
        date: p.date,
        method: p.method,
        amount: p.amount,
        bank_name: p.bankName || null,
        transaction_no: p.transactionNo || null,
        cheque_no: p.chequeNo || null,
        cheque_date: p.chequeDate || null,
        remarks: p.remarks || null,
        entered_by: p.enteredBy || 'Unknown',
      }));
      const { error } = await supabase.from('payments').upsert(payments);
      if (error) console.error(`  ⚠️ Payments for "${b.bookingId}":`, error.message);
      else stats.payments += payments.length;
    }

    // Insert audit logs
    if (b.auditLog && b.auditLog.length > 0) {
      const logs = b.auditLog.map((log: any) => ({
        booking_id: b.bookingId,
        timestamp: log.timestamp,
        user_name: log.user || 'System',
        action: log.action,
        details: log.details || null,
      }));
      const { error } = await supabase.from('audit_logs').insert(logs);
      if (error) console.error(`  ⚠️ Audit logs for "${b.bookingId}":`, error.message);
      else stats.auditLogs += logs.length;
    }
  }
  console.log(`  ✅ Migrated ${stats.bookings} bookings, ${stats.bookingLineItems} items, ${stats.payments} payments, ${stats.auditLogs} audit logs`);
}

// ─── Migrate Sequences ───────────────────────────────────────

async function migrateSequences() {
  console.log('\n🔢 Migrating sequences...');

  const seqPayload = await pullOldPayload('sequence');
  const quotationSeq = seqPayload ? (seqPayload.data as number) || 0 : 0;

  const bSeqPayload = await pullOldPayload('booking_sequence');
  const bookingSeq = bSeqPayload ? (bSeqPayload.data as number) || 0 : 0;

  await supabase.from('sequences').upsert([
    { id: 'quotation', value: quotationSeq, updated_at: new Date().toISOString() },
    { id: 'booking', value: bookingSeq, updated_at: new Date().toISOString() },
  ]);

  console.log(`  ✅ Quotation sequence: ${quotationSeq}, Booking sequence: ${bookingSeq}`);
}

// ─── Main ────────────────────────────────────────────────────

async function main() {
  console.log('═══════════════════════════════════════════════');
  console.log('  KVU ERP — Migration: appdata → Row-Level');
  console.log('═══════════════════════════════════════════════');
  console.log(`Supabase URL: ${supabaseUrl}`);

  const start = Date.now();

  await migrateCustomers();
  await migrateQuotations();
  await migrateBookings();
  await migrateSequences();

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);

  console.log('\n═══════════════════════════════════════════════');
  console.log('  Migration Complete!');
  console.log('═══════════════════════════════════════════════');
  console.log(`  Customers:            ${stats.customers}`);
  console.log(`  Quotations:           ${stats.quotations}`);
  console.log(`  Quotation Line Items: ${stats.quotationLineItems}`);
  console.log(`  Bookings:             ${stats.bookings}`);
  console.log(`  Booking Line Items:   ${stats.bookingLineItems}`);
  console.log(`  Payments:             ${stats.payments}`);
  console.log(`  Audit Logs:           ${stats.auditLogs}`);
  console.log(`  Time:                 ${elapsed}s`);
  console.log('───────────────────────────────────────────────');
  console.log('  ⚠️  The old `appdata` table has NOT been deleted.');
  console.log('  Keep it for 30 days as a backup, then remove.');
  console.log('═══════════════════════════════════════════════\n');
}

main().catch(err => {
  console.error('💥 Migration failed:', err);
  process.exit(1);
});
