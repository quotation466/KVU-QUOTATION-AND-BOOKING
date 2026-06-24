import { BookingRepository, type Booking, type Payment } from './BookingRepository';

export interface AggregatedPayment extends Payment {
  bookingId: string;
  custName: string;
  bookingIndex: number;
  bookingSeqNo: string;
}

export const PaymentRepository = {
  // Retrieve all payments across all bookings asynchronously
  async getAllPayments(): Promise<AggregatedPayment[]> {
    const bookings = await BookingRepository.getBookings();
    const list: AggregatedPayment[] = [];

    bookings.forEach((b, bIdx) => {
      const seq = b.bookingId.split('/')[1] || '0000';
      if (b.payments && b.payments.length > 0) {
        b.payments.forEach((p) => {
          list.push({
            ...p,
            bookingId: b.bookingId,
            custName: b.custName,
            bookingIndex: bIdx,
            bookingSeqNo: seq
          });
        });
      }
    });

    // Sort by date descending (latest first)
    return list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  },

  // Delegate subsequent payment operations to BookingRepository
  async addPayment(bookingIndex: number, payment: Payment, bookingId?: string): Promise<Booking[]> {
    return BookingRepository.addPayment(bookingIndex, payment, bookingId);
  },

  async editPayment(bookingIndex: number, paymentId: string, updatedPayment: Partial<Payment>, adminName: string, bookingId?: string): Promise<Booking[]> {
    return BookingRepository.editPayment(bookingIndex, paymentId, updatedPayment, adminName, bookingId);
  },

  async deletePayment(bookingIndex: number, paymentId: string, adminName: string, bookingId?: string): Promise<Booking[]> {
    return BookingRepository.deletePayment(bookingIndex, paymentId, adminName, bookingId);
  }
};
