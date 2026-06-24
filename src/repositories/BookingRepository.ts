import { SupabaseService } from '../services/SupabaseService';
export type { LineItem } from '../types/LineItem';
import type { LineItem } from '../types/LineItem';
export type BookingLineItem = LineItem;

export interface Payment {
  id: string;
  date: string;
  method: 'Cash' | 'UPI' | 'NEFT/RTGS' | 'Cheque' | 'None';
  amount: number;
  bankName?: string;
  transactionNo?: string;
  chequeNo?: string;
  chequeDate?: string;
  remarks?: string;
  enteredBy: string;
}

export interface AuditLog {
  timestamp: string;
  user: string;
  action: string;
  details: string;
}

export interface Booking {
  bookingId: string;
  bookingDate: string;
  deliveryDate: string;
  custName: string;
  custGender: 'male' | 'female';
  relation: string;
  fatherName: string;
  address: string;
  post: string;
  district: string;
  state: string;
  pincode: string;
  mobile: string;
  aadhar?: string;
  items: LineItem[];
  originalPrice: number;
  additionalCharges: number;
  discount: number;
  totalAmount: number;
  advancePaid: number;
  paymentMode: 'Cash' | 'UPI' | 'NEFT/RTGS' | 'Cheque' | 'None';
  balanceDue: number;
  paymentStatus: 'No Advance' | 'Advance Received' | 'Partially Paid' | 'Fully Paid';
  payments: Payment[];
  requiredAdvance?: number;
  auditLog: AuditLog[];
  cyclone?: string;
  jhanna?: string;
  tractor?: string;
  hp?: string;
  pullySize?: string;
  ptoShaft?: string;
  notes?: string;
  status: 'Pending' | 'Delivered' | 'Cancelled';
  savedAt: string;
}

export const BookingRepository = {
  // Sequence
  async getSequence(): Promise<number> {
    if (navigator.onLine) {
      const seq = await SupabaseService.getSequence('booking');
      if (seq !== null) {
        localStorage.setItem('kvu_booking_sequence', String(seq));
        return seq;
      }
    }
    const cached = localStorage.getItem('kvu_booking_sequence');
    return cached ? Number(cached) : 0;
  },

  async incrementSequence(): Promise<number> {
    if (navigator.onLine) {
      const next = await SupabaseService.incrementSequence('booking');
      if (next !== null) {
        localStorage.setItem('kvu_booking_sequence', String(next));
        return next;
      }
    }
    const cached = localStorage.getItem('kvu_booking_sequence');
    const nextLocal = (cached ? Number(cached) : 0) + 1;
    localStorage.setItem('kvu_booking_sequence', String(nextLocal));
    return nextLocal;
  },

  async resetSequence(): Promise<number> {
    if (navigator.onLine) {
      await SupabaseService.setSequence('booking', 0);
    }
    localStorage.setItem('kvu_booking_sequence', '0');
    return 0;
  },

  // Bookings
  async getBookings(): Promise<Booking[]> {
    if (navigator.onLine) {
      const list = await SupabaseService.pullAllBookings();
      if (list !== null) {
        localStorage.setItem('kvu_bookings', JSON.stringify(list));
        return list;
      }
    }
    const cached = localStorage.getItem('kvu_bookings');
    return cached ? JSON.parse(cached) : [];
  },

  async saveBooking(booking: Booking, editingIndex?: number): Promise<{ bookings: Booking[]; nextSeq: number }> {
    const timestamp = new Date().toISOString();
    const isNew = !booking.bookingId || editingIndex === undefined;
    
    let nextSeq = await this.getSequence();
    const bookingToSave = { ...booking, savedAt: timestamp };

    if (isNew) {
      nextSeq = await this.incrementSequence();
    }

    if (navigator.onLine) {
      await SupabaseService.upsertBooking(bookingToSave);
    }

    const currentBookings = await this.getBookings();
    let updatedBookings: Booking[];
    if (editingIndex !== undefined && editingIndex >= 0 && editingIndex < currentBookings.length) {
      updatedBookings = [...currentBookings];
      updatedBookings[editingIndex] = bookingToSave;
    } else {
      const existingIdx = currentBookings.findIndex(b => b.bookingId === bookingToSave.bookingId);
      if (existingIdx !== -1) {
        updatedBookings = [...currentBookings];
        updatedBookings[existingIdx] = bookingToSave;
      } else {
        updatedBookings = [bookingToSave, ...currentBookings];
      }
    }
    localStorage.setItem('kvu_bookings', JSON.stringify(updatedBookings));

    return { bookings: updatedBookings, nextSeq };
  },

  async deleteBooking(_index: number, bookingId?: string): Promise<Booking[]> {
    if (bookingId) {
      if (navigator.onLine) {
        await SupabaseService.softDeleteBooking(bookingId);
      }
      const bookings = await this.getBookings();
      const updated = bookings.filter(b => b.bookingId !== bookingId);
      localStorage.setItem('kvu_bookings', JSON.stringify(updated));
      return updated;
    }
    return this.getBookings();
  },

  async toggleBookingStatus(_index: number, bookingId?: string): Promise<Booking[]> {
    if (!bookingId) return this.getBookings();
    
    const bookings = await this.getBookings();
    const bIdx = bookings.findIndex(item => item.bookingId === bookingId);
    if (bIdx === -1) return bookings;

    const updatedBookings = [...bookings];
    const b = { ...updatedBookings[bIdx] };
    const newStatus = b.status === 'Pending' ? 'Delivered' : 'Pending';
    b.status = newStatus;
    b.auditLog = b.auditLog ? [...b.auditLog] : [];
    b.auditLog.push({
      timestamp: new Date().toISOString(),
      user: 'Admin',
      action: 'Status Changed',
      details: `Booking status changed to ${newStatus}`
    });
    b.savedAt = new Date().toISOString();
    updatedBookings[bIdx] = b;

    if (navigator.onLine) {
      await SupabaseService.upsertBooking(b);
    }
    localStorage.setItem('kvu_bookings', JSON.stringify(updatedBookings));
    return updatedBookings;
  },

  async cancelBooking(_index: number, bookingId?: string): Promise<Booking[]> {
    if (!bookingId) return this.getBookings();
    
    const bookings = await this.getBookings();
    const bIdx = bookings.findIndex(item => item.bookingId === bookingId);
    if (bIdx === -1) return bookings;

    const updatedBookings = [...bookings];
    const b = { ...updatedBookings[bIdx] };
    const newStatus = b.status === 'Cancelled' ? 'Pending' : 'Cancelled';
    b.status = newStatus;
    b.auditLog = b.auditLog ? [...b.auditLog] : [];
    b.auditLog.push({
      timestamp: new Date().toISOString(),
      user: 'Admin',
      action: newStatus === 'Cancelled' ? 'Booking Cancelled' : 'Booking Restored',
      details: newStatus === 'Cancelled' ? 'Booking status changed to Cancelled' : 'Booking status changed to Pending'
    });
    b.savedAt = new Date().toISOString();
    updatedBookings[bIdx] = b;

    if (navigator.onLine) {
      await SupabaseService.upsertBooking(b);
    }
    localStorage.setItem('kvu_bookings', JSON.stringify(updatedBookings));
    return updatedBookings;
  },

  async addPayment(_bookingIndex: number, payment: Payment, bookingId?: string): Promise<Booking[]> {
    if (!bookingId) return this.getBookings();
    
    const bookings = await this.getBookings();
    const bIdx = bookings.findIndex(item => item.bookingId === bookingId);
    if (bIdx === -1) return bookings;

    const updatedBookings = [...bookings];
    const b = { ...updatedBookings[bIdx] };
    b.payments = b.payments ? [...b.payments] : [];
    b.payments.push(payment);
    b.paymentMode = payment.method;
    
    this._recalcPaymentStatus(b);

    b.auditLog = b.auditLog ? [...b.auditLog] : [];
    b.auditLog.push({
      timestamp: new Date().toISOString(),
      user: payment.enteredBy,
      action: 'Payment Added',
      details: `Payment of Rs. ${payment.amount} added via ${payment.method}. Balance due: Rs. ${b.balanceDue}`
    });
    b.savedAt = new Date().toISOString();
    updatedBookings[bIdx] = b;

    if (navigator.onLine) {
      await SupabaseService.upsertBooking(b);
    }
    localStorage.setItem('kvu_bookings', JSON.stringify(updatedBookings));
    return updatedBookings;
  },

  async editPayment(_bookingIndex: number, paymentId: string, updatedPayment: Partial<Payment>, adminName: string, bookingId?: string): Promise<Booking[]> {
    if (!bookingId) return this.getBookings();

    const bookings = await this.getBookings();
    const bIdx = bookings.findIndex(item => item.bookingId === bookingId);
    if (bIdx === -1 || !bookings[bIdx].payments) return bookings;

    const updatedBookings = [...bookings];
    const b = { ...updatedBookings[bIdx] };
    b.payments = [...(b.payments || [])];
    
    const pIdx = b.payments.findIndex(p => p.id === paymentId);
    if (pIdx === -1) return bookings;

    const oldAmt = b.payments[pIdx].amount;
    const oldMethod = b.payments[pIdx].method;
    b.payments[pIdx] = { ...b.payments[pIdx], ...updatedPayment };

    if (updatedPayment.method) {
      b.paymentMode = updatedPayment.method;
    }
    this._recalcPaymentStatus(b);

    b.auditLog = b.auditLog ? [...b.auditLog] : [];
    b.auditLog.push({
      timestamp: new Date().toISOString(),
      user: adminName,
      action: 'Payment Edited',
      details: `Payment edited. Old: Rs. ${oldAmt} (${oldMethod}), New: Rs. ${b.payments[pIdx].amount} (${b.payments[pIdx].method}). Balance due: Rs. ${b.balanceDue}`
    });
    b.savedAt = new Date().toISOString();
    updatedBookings[bIdx] = b;

    if (navigator.onLine) {
      await SupabaseService.upsertBooking(b);
    }
    localStorage.setItem('kvu_bookings', JSON.stringify(updatedBookings));
    return updatedBookings;
  },

  async deletePayment(_bookingIndex: number, paymentId: string, adminName: string, bookingId?: string): Promise<Booking[]> {
    if (!bookingId) return this.getBookings();

    const bookings = await this.getBookings();
    const bIdx = bookings.findIndex(item => item.bookingId === bookingId);
    if (bIdx === -1 || !bookings[bIdx].payments) return bookings;

    const updatedBookings = [...bookings];
    const b = { ...updatedBookings[bIdx] };
    b.payments = [...(b.payments || [])];

    const pIdx = b.payments.findIndex(p => p.id === paymentId);
    if (pIdx === -1) return bookings;

    const [deletedPay] = b.payments.splice(pIdx, 1);

    if (b.payments.length > 0) {
      b.paymentMode = b.payments[b.payments.length - 1].method;
    } else {
      b.paymentMode = 'None';
    }
    this._recalcPaymentStatus(b);

    b.auditLog = b.auditLog ? [...b.auditLog] : [];
    b.auditLog.push({
      timestamp: new Date().toISOString(),
      user: adminName,
      action: 'Payment Deleted',
      details: `Deleted payment of Rs. ${deletedPay.amount} via ${deletedPay.method}. Balance due: Rs. ${b.balanceDue}`
    });
    b.savedAt = new Date().toISOString();
    updatedBookings[bIdx] = b;

    if (navigator.onLine) {
      await SupabaseService.upsertBooking(b);
    }
    localStorage.setItem('kvu_bookings', JSON.stringify(updatedBookings));
    return updatedBookings;
  },

  _recalcPaymentStatus(b: Booking): void {
    const totalPaid = b.payments.reduce((sum, p) => sum + p.amount, 0);
    b.advancePaid = totalPaid;
    b.balanceDue = b.totalAmount - totalPaid;

    if (totalPaid === 0) {
      b.paymentStatus = 'No Advance';
    } else if (totalPaid >= b.totalAmount) {
      b.paymentStatus = 'Fully Paid';
    } else if (b.payments.length === 1) {
      b.paymentStatus = 'Advance Received';
    } else {
      b.paymentStatus = 'Partially Paid';
    }
  },

  async pullBookingsAndSequence(): Promise<{ bookings: Booking[] | null; sequence: number | null }> {
    const bookings = await this.getBookings();
    const sequence = await this.getSequence();
    return { bookings, sequence };
  }
};
