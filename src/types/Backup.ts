import type { Customer } from '../repositories/CustomerRepository';
import type { Quotation } from '../repositories/QuotationRepository';
import type { Booking } from '../repositories/BookingRepository';

export interface ERPBackup {
  exportedAt: string;
  version: number;
  history: Quotation[];
  customers: Customer[];
  bookings: Booking[];
  sequence: number;
  booking_sequence: number;
  products: any[];
  deleted_history?: string[];
  deleted_customers?: string[];
  deleted_bookings?: string[];
}
