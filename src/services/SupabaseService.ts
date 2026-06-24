import { supabase } from '../config/supabaseClient';

// ─── Helpers ─────────────────────────────────────────────────

const isOnline = () => navigator.onLine;

/**
 * Maps a Supabase booking row (with JOINed children) back to the app's Booking shape.
 */
function mapBookingFromRow(row: any): any {
  return {
    bookingId: row.booking_id,
    bookingDate: row.booking_date,
    deliveryDate: row.delivery_date,
    custName: row.cust_name,
    custGender: row.cust_gender,
    relation: row.relation,
    fatherName: row.father_name,
    address: row.address,
    post: row.post,
    district: row.district,
    state: row.state,
    pincode: row.pincode,
    mobile: row.mobile,
    aadhar: row.aadhar,
    originalPrice: parseFloat(row.original_price) || 0,
    additionalCharges: parseFloat(row.additional_charges) || 0,
    discount: parseFloat(row.discount) || 0,
    totalAmount: parseFloat(row.total_amount) || 0,
    advancePaid: parseFloat(row.advance_paid) || 0,
    paymentMode: row.payment_mode,
    balanceDue: parseFloat(row.balance_due) || 0,
    paymentStatus: row.payment_status,
    requiredAdvance: parseFloat(row.required_advance) || 0,
    cyclone: row.cyclone,
    jhanna: row.jhanna,
    tractor: row.tractor,
    hp: row.hp,
    pullySize: row.pully_size,
    ptoShaft: row.pto_shaft,
    notes: row.notes,
    status: row.status,
    items: (row.booking_line_items || [])
      .sort((a: any, b: any) => a.sort_order - b.sort_order)
      .map((li: any) => ({
        id: li.id,
        name: li.name,
        desc: li.description,
        qty: parseFloat(li.qty) || 1,
        rate: parseFloat(li.rate) || 0,
        amount: parseFloat(li.amount) || 0,
      })),
    payments: (row.payments || [])
      .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .map((p: any) => ({
        id: p.id,
        date: p.date,
        method: p.method,
        amount: parseFloat(p.amount) || 0,
        bankName: p.bank_name,
        transactionNo: p.transaction_no,
        chequeNo: p.cheque_no,
        chequeDate: p.cheque_date,
        remarks: p.remarks,
        enteredBy: p.entered_by,
      })),
    auditLog: (row.audit_logs || [])
      .sort((a: any, b: any) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
      .map((log: any) => ({
        timestamp: log.timestamp,
        user: log.user_name,
        action: log.action,
        details: log.details,
      })),
    savedAt: row.saved_at,
  };
}

/**
 * Maps a Supabase quotation row (with JOINed line items) back to the app's Quotation shape.
 */
function mapQuotationFromRow(row: any): any {
  return {
    ref: row.ref,
    date: row.date,
    dateVal: row.date_val,
    custName: row.cust_name,
    gender: row.gender,
    relation: row.relation,
    fatherName: row.father_name,
    address: row.address,
    post: row.post,
    district: row.district,
    state: row.state,
    pincode: row.pincode,
    mobile: row.mobile,
    aadhar: row.aadhar,
    heading: row.heading,
    hsn: row.hsn,
    capacity: row.capacity,
    power: row.power,
    discount: parseFloat(row.discount) || 0,
    gstRate: parseFloat(row.gst_rate) || 0,
    incInst: row.inc_inst,
    grandTotal: parseFloat(row.grand_total) || 0,
    grandTotalFmt: row.grand_total_fmt,
    items: (row.quotation_line_items || [])
      .sort((a: any, b: any) => a.sort_order - b.sort_order)
      .map((li: any) => ({
        id: li.id,
        name: li.name,
        desc: li.description,
        qty: parseFloat(li.qty) || 1,
        rate: parseFloat(li.rate) || 0,
        amount: parseFloat(li.amount) || 0,
      })),
    savedAt: row.saved_at,
  };
}

/**
 * Maps a Supabase customer row back to the app's Customer shape.
 */
function mapCustomerFromRow(row: any): any {
  return {
    name: row.name,
    gender: row.gender,
    father: row.father,
    address: row.address,
    post: row.post,
    district: row.district,
    state: row.state,
    pincode: row.pincode,
    mobile: row.mobile,
    aadhar: row.aadhar,
    gstin: row.gstin,
    savedAt: row.saved_at,
  };
}

// ─── Service ─────────────────────────────────────────────────

export const SupabaseService = {
  // ============================================================
  // CUSTOMERS
  // ============================================================

  async upsertCustomer(customer: any): Promise<boolean> {
    if (!isOnline()) return false;
    try {
      const { error } = await supabase.from('customers').upsert({
        name: customer.name,
        gender: customer.gender || null,
        father: customer.father || null,
        address: customer.address || null,
        post: customer.post || null,
        district: customer.district || null,
        state: customer.state || null,
        pincode: customer.pincode || null,
        mobile: customer.mobile || null,
        aadhar: customer.aadhar || null,
        gstin: customer.gstin || null,
        saved_at: customer.savedAt || new Date().toISOString(),
        deleted_at: null,  // un-delete if re-added
      }, { onConflict: 'name,mobile' });

      if (error) {
        console.error('[SupabaseService] Customer upsert failed:', error.message);
        return false;
      }
      return true;
    } catch (err) {
      console.error('[SupabaseService] Customer upsert exception:', err);
      return false;
    }
  },

  async softDeleteCustomer(nameKey: string, mobileKey: string): Promise<boolean> {
    if (!isOnline()) return false;
    try {
      const { error } = await supabase.from('customers')
        .update({ deleted_at: new Date().toISOString() })
        .eq('name', nameKey)
        .eq('mobile', mobileKey || '');

      if (error) {
        console.error('[SupabaseService] Customer soft delete failed:', error.message);
        return false;
      }
      return true;
    } catch (err) {
      console.error('[SupabaseService] Customer soft delete exception:', err);
      return false;
    }
  },

  async pullAllCustomers(): Promise<any[] | null> {
    if (!isOnline()) return null;
    try {
      const { data, error } = await supabase.from('customers')
        .select('*')
        .is('deleted_at', null);

      if (error) {
        console.error('[SupabaseService] Customers pull failed:', error.message);
        return null;
      }
      return (data || []).map(mapCustomerFromRow);
    } catch (err) {
      console.error('[SupabaseService] Customers pull exception:', err);
      return null;
    }
  },

  async pullCustomersSince(since: string): Promise<any[] | null> {
    if (!isOnline()) return null;
    try {
      const { data, error } = await supabase.from('customers')
        .select('*')
        .gt('saved_at', since);
      if (error) return null;
      return (data || []).map(row => ({
        ...mapCustomerFromRow(row),
        _deleted: !!row.deleted_at,
      }));
    } catch {
      return null;
    }
  },

  // ============================================================
  // QUOTATIONS
  // ============================================================

  async upsertQuotation(quote: any): Promise<boolean> {
    if (!isOnline()) return false;
    try {
      // 1. Upsert quotation row
      const { error: qError } = await supabase.from('quotations').upsert({
        ref: quote.ref,
        date: quote.date,
        date_val: quote.dateVal,
        cust_name: quote.custName,
        gender: quote.gender,
        relation: quote.relation,
        father_name: quote.fatherName || null,
        address: quote.address || null,
        post: quote.post || null,
        district: quote.district || null,
        state: quote.state || null,
        pincode: quote.pincode || null,
        mobile: quote.mobile || null,
        aadhar: quote.aadhar || null,
        heading: quote.heading,
        hsn: quote.hsn || null,
        capacity: quote.capacity || null,
        power: quote.power || null,
        discount: quote.discount || 0,
        gst_rate: quote.gstRate || 0,
        inc_inst: quote.incInst || false,
        grand_total: quote.grandTotal || 0,
        grand_total_fmt: quote.grandTotalFmt || '',
        saved_at: quote.savedAt || new Date().toISOString(),
        deleted_at: null,
      });
      if (qError) {
        console.error('[SupabaseService] Quotation upsert failed:', qError.message);
        return false;
      }

      // 2. Replace line items (delete existing + insert new)
      await supabase.from('quotation_line_items').delete().eq('quotation_ref', quote.ref);

      if (quote.items && quote.items.length > 0) {
        const lineItems = quote.items.map((item: any, idx: number) => ({
          quotation_ref: quote.ref,
          sort_order: idx,
          name: item.name,
          description: item.desc || null,
          qty: item.qty || 1,
          rate: item.rate || 0,
          amount: item.amount || 0,
        }));
        const { error: liError } = await supabase.from('quotation_line_items').insert(lineItems);
        if (liError) console.error('[SupabaseService] Quotation line items failed:', liError.message);
      }
      return true;
    } catch (err) {
      console.error('[SupabaseService] Quotation upsert exception:', err);
      return false;
    }
  },

  async softDeleteQuotation(ref: string): Promise<boolean> {
    if (!isOnline()) return false;
    try {
      const { error } = await supabase.from('quotations')
        .update({ deleted_at: new Date().toISOString() })
        .eq('ref', ref);
      if (error) {
        console.error('[SupabaseService] Quotation soft delete failed:', error.message);
        return false;
      }
      return true;
    } catch (err) {
      console.error('[SupabaseService] Quotation soft delete exception:', err);
      return false;
    }
  },

  async pullAllQuotations(): Promise<any[] | null> {
    if (!isOnline()) return null;
    try {
      const { data, error } = await supabase.from('quotations')
        .select('*, quotation_line_items(*)')
        .is('deleted_at', null)
        .order('saved_at', { ascending: false });
      if (error) {
        console.error('[SupabaseService] Quotations pull failed:', error.message);
        return null;
      }
      return (data || []).map(mapQuotationFromRow);
    } catch (err) {
      console.error('[SupabaseService] Quotations pull exception:', err);
      return null;
    }
  },

  async pullQuotationsSince(since: string): Promise<any[] | null> {
    if (!isOnline()) return null;
    try {
      const { data, error } = await supabase.from('quotations')
        .select('*, quotation_line_items(*)')
        .gt('saved_at', since);
      if (error) return null;
      return (data || []).map(row => ({
        ...mapQuotationFromRow(row),
        _deleted: !!row.deleted_at,
      }));
    } catch {
      return null;
    }
  },

  // ============================================================
  // BOOKINGS
  // ============================================================

  async upsertBooking(booking: any): Promise<boolean> {
    if (!isOnline()) return false;
    try {
      // 1. Upsert booking row
      const { error: bError } = await supabase.from('bookings').upsert({
        booking_id: booking.bookingId,
        booking_date: booking.bookingDate,
        delivery_date: booking.deliveryDate || null,
        cust_name: booking.custName,
        cust_gender: booking.custGender,
        relation: booking.relation || null,
        father_name: booking.fatherName || null,
        address: booking.address || null,
        post: booking.post || null,
        district: booking.district || null,
        state: booking.state || null,
        pincode: booking.pincode || null,
        mobile: booking.mobile || null,
        aadhar: booking.aadhar || null,
        original_price: booking.originalPrice || 0,
        additional_charges: booking.additionalCharges || 0,
        discount: booking.discount || 0,
        total_amount: booking.totalAmount || 0,
        advance_paid: booking.advancePaid || 0,
        payment_mode: booking.paymentMode || 'None',
        balance_due: booking.balanceDue || 0,
        payment_status: booking.paymentStatus || 'No Advance',
        required_advance: booking.requiredAdvance || 0,
        cyclone: booking.cyclone ?? 'No',
        jhanna: booking.jhanna ?? 'No',
        tractor: booking.tractor || null,
        hp: booking.hp || null,
        pully_size: booking.pullySize || null,
        pto_shaft: booking.ptoShaft || null,
        notes: booking.notes || null,
        status: booking.status || 'Pending',
        saved_at: booking.savedAt || new Date().toISOString(),
        deleted_at: null,
      });
      if (bError) {
        console.error('[SupabaseService] Booking upsert failed:', bError.message);
        return false;
      }

      // 2. Replace line items
      await supabase.from('booking_line_items').delete().eq('booking_id', booking.bookingId);
      if (booking.items && booking.items.length > 0) {
        const lineItems = booking.items.map((item: any, idx: number) => ({
          booking_id: booking.bookingId,
          sort_order: idx,
          name: item.name,
          description: item.desc || null,
          qty: item.qty || 1,
          rate: item.rate || 0,
          amount: item.amount || 0,
        }));
        const { error: liError } = await supabase.from('booking_line_items').insert(lineItems);
        if (liError) console.error('[SupabaseService] Booking line items failed:', liError.message);
      }

      // 3. Upsert payments (idempotent by payment.id)
      if (booking.payments && booking.payments.length > 0) {
        // Delete payments that no longer exist locally (handles payment deletion)
        const { data: existingPayments } = await supabase.from('payments')
          .select('id')
          .eq('booking_id', booking.bookingId);
        const localPaymentIds = new Set(booking.payments.map((p: any) => p.id));
        const toDelete = (existingPayments || []).filter((p: any) => !localPaymentIds.has(p.id));
        for (const p of toDelete) {
          await supabase.from('payments').delete().eq('id', p.id);
        }

        const payments = booking.payments.map((p: any) => ({
          id: p.id,
          booking_id: booking.bookingId,
          date: p.date,
          method: p.method,
          amount: p.amount,
          bank_name: p.bankName || null,
          transaction_no: p.transactionNo || null,
          cheque_no: p.chequeNo || null,
          cheque_date: p.chequeDate || null,
          remarks: p.remarks || null,
          entered_by: p.enteredBy,
        }));
        const { error: pError } = await supabase.from('payments').upsert(payments);
        if (pError) console.error('[SupabaseService] Payments upsert failed:', pError.message);
      } else {
        // No local payments — delete all remote payments for this booking
        await supabase.from('payments').delete().eq('booking_id', booking.bookingId);
      }

      // 4. Replace audit logs (append-only is ideal, but replace keeps them in sync)
      await supabase.from('audit_logs').delete().eq('booking_id', booking.bookingId);
      if (booking.auditLog && booking.auditLog.length > 0) {
        const logs = booking.auditLog.map((log: any) => ({
          booking_id: booking.bookingId,
          timestamp: log.timestamp,
          user_name: log.user,
          action: log.action,
          details: log.details || null,
        }));
        const { error: aError } = await supabase.from('audit_logs').insert(logs);
        if (aError) console.error('[SupabaseService] Audit logs failed:', aError.message);
      }

      return true;
    } catch (err) {
      console.error('[SupabaseService] Booking upsert exception:', err);
      return false;
    }
  },

  async softDeleteBooking(bookingId: string): Promise<boolean> {
    if (!isOnline()) return false;
    try {
      const { error } = await supabase.from('bookings')
        .update({ deleted_at: new Date().toISOString() })
        .eq('booking_id', bookingId);
      if (error) {
        console.error('[SupabaseService] Booking soft delete failed:', error.message);
        return false;
      }
      return true;
    } catch (err) {
      console.error('[SupabaseService] Booking soft delete exception:', err);
      return false;
    }
  },

  async pullAllBookings(): Promise<any[] | null> {
    if (!isOnline()) return null;
    try {
      const { data, error } = await supabase.from('bookings')
        .select('*, booking_line_items(*), payments(*), audit_logs(*)')
        .is('deleted_at', null)
        .order('saved_at', { ascending: false });
      if (error) {
        console.error('[SupabaseService] Bookings pull failed:', error.message);
        return null;
      }
      return (data || []).map(mapBookingFromRow);
    } catch (err) {
      console.error('[SupabaseService] Bookings pull exception:', err);
      return null;
    }
  },

  async pullBookingsSince(since: string): Promise<any[] | null> {
    if (!isOnline()) return null;
    try {
      const { data, error } = await supabase.from('bookings')
        .select('*, booking_line_items(*), payments(*), audit_logs(*)')
        .gt('saved_at', since);
      if (error) return null;
      return (data || []).map(row => ({
        ...mapBookingFromRow(row),
        _deleted: !!row.deleted_at,
      }));
    } catch {
      return null;
    }
  },

  // ============================================================
  // SEQUENCES
  // ============================================================

  async getSequence(type: 'quotation' | 'booking'): Promise<number | null> {
    if (!isOnline()) return null;
    try {
      const { data, error } = await supabase.from('sequences')
        .select('value')
        .eq('id', type)
        .maybeSingle();
      if (error) return null;
      return data?.value ?? 0;
    } catch {
      return null;
    }
  },

  async setSequence(type: 'quotation' | 'booking', value: number): Promise<boolean> {
    if (!isOnline()) return false;
    try {
      const { error } = await supabase.from('sequences').upsert({
        id: type,
        value,
        updated_at: new Date().toISOString(),
      });
      if (error) {
        console.error('[SupabaseService] Sequence update failed:', error.message);
        return false;
      }
      return true;
    } catch (err) {
      console.error('[SupabaseService] Sequence update exception:', err);
      return false;
    }
  },

  /**
   * Atomically increments and returns the next sequence value.
   * Requires a Postgres RPC function `increment_sequence(type text)` to be created:
   * 
   * CREATE OR REPLACE FUNCTION increment_sequence(p_type text)
   * RETURNS integer LANGUAGE plpgsql AS $$
   * DECLARE v_new_val integer;
   * BEGIN
   *   UPDATE sequences SET value = value + 1, updated_at = now() WHERE id = p_type
   *   RETURNING value INTO v_new_val;
   *   IF NOT FOUND THEN
   *     INSERT INTO sequences (id, value, updated_at) VALUES (p_type, 1, now())
   *     RETURNING value INTO v_new_val;
   *   END IF;
   *   RETURN v_new_val;
   * END;
   * $$;
   */
  async incrementSequence(type: 'quotation' | 'booking'): Promise<number | null> {
    if (!isOnline()) return null;
    try {
      const { data, error } = await supabase.rpc('increment_sequence', { p_type: type });
      if (error) {
        console.error('[SupabaseService] Atomic sequence increment failed:', error.message);
        // Fallback to non-atomic (with warning)
        const current = await this.getSequence(type);
        const next = (current || 0) + 1;
        await this.setSequence(type, next);
        return next;
      }
      return data as number;
    } catch (err) {
      console.error('[SupabaseService] Atomic sequence increment exception:', err);
      const current = await this.getSequence(type);
      const next = (current || 0) + 1;
      await this.setSequence(type, next);
      return next;
    }
  },

  // ============================================================
  // PRODUCTS — kept as JSON blob in legacy appdata table
  // ============================================================

  async upsertProducts(products: any[]): Promise<boolean> {
    if (!isOnline()) return false;
    try {
      const { error } = await supabase.from('appdata').upsert({
        id: 'products',
        payload: { data: products },
        updated_at: new Date().toISOString(),
      });
      if (error) return false;
      return true;
    } catch {
      return false;
    }
  },

  async pullProducts(): Promise<any[] | null> {
    if (!isOnline()) return null;
    try {
      const { data, error } = await supabase.from('appdata')
        .select('payload')
        .eq('id', 'products');
      if (error || !data || data.length === 0) return null;
      return data[0].payload?.data || [];
    } catch {
      return null;
    }
  },

  // ============================================================
  // BULK CLEAR — used by reset database feature
  // ============================================================

  async clearAllTables(): Promise<boolean> {
    if (!isOnline()) return false;
    try {
      // Order matters: children before parents (FK constraints)
      await supabase.from('audit_logs').delete().neq('booking_id', '');
      await supabase.from('payments').delete().neq('id', '');
      await supabase.from('booking_line_items').delete().neq('booking_id', '');
      await supabase.from('bookings').delete().neq('booking_id', '');
      await supabase.from('quotation_line_items').delete().neq('quotation_ref', '');
      await supabase.from('quotations').delete().neq('ref', '');
      await supabase.from('customers').delete().neq('name', '');
      await supabase.from('sequences').upsert([
        { id: 'quotation', value: 0, updated_at: new Date().toISOString() },
        { id: 'booking', value: 0, updated_at: new Date().toISOString() },
      ]);
      // Clear products from legacy appdata table
      await supabase.from('appdata').delete().eq('id', 'products');
      return true;
    } catch (err) {
      console.error('[SupabaseService] Clear all tables failed:', err);
      return false;
    }
  },
  // ============================================================
  // APP USERS — login credentials stored in Supabase
  // ============================================================

  async pullAllUsers(): Promise<any[] | null> {
    if (!isOnline()) return null;
    try {
      const { data, error } = await supabase
        .from('app_users')
        .select('*')
        .order('created_at', { ascending: true });
      if (error) {
        console.error('[SupabaseService] Users pull failed:', error.message);
        return null;
      }
      return (data || []).map((row: any) => ({
        userId: row.user_id,
        username: row.username,
        passwordHash: row.password_hash,
        salt: row.salt,
        role: row.role,
        createdAt: row.created_at,
      }));
    } catch (err) {
      console.error('[SupabaseService] Users pull exception:', err);
      return null;
    }
  },

  async upsertUser(user: any): Promise<boolean> {
    if (!isOnline()) return false;
    try {
      const { error } = await supabase.from('app_users').upsert({
        user_id: user.userId,
        username: user.username,
        password_hash: user.passwordHash,
        salt: user.salt,
        role: user.role,
        created_at: user.createdAt || new Date().toISOString(),
      }, { onConflict: 'user_id' });
      if (error) {
        console.error('[SupabaseService] User upsert failed:', error.message);
        return false;
      }
      return true;
    } catch (err) {
      console.error('[SupabaseService] User upsert exception:', err);
      return false;
    }
  },

  async deleteUser(userId: string): Promise<boolean> {
    if (!isOnline()) return false;
    try {
      const { error } = await supabase
        .from('app_users')
        .delete()
        .eq('user_id', userId);
      if (error) {
        console.error('[SupabaseService] User delete failed:', error.message);
        return false;
      }
      return true;
    } catch (err) {
      console.error('[SupabaseService] User delete exception:', err);
      return false;
    }
  },
};
