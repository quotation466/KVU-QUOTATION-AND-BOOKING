import { QuotationRepository } from '../repositories/QuotationRepository';
import { CustomerRepository } from '../repositories/CustomerRepository';
import { BookingRepository } from '../repositories/BookingRepository';

export const SyncService = {
  /**
   * Refetches all data from Supabase to refresh the local memory states of the app.
   */
  async fullSync(): Promise<{ success: boolean; errors: string[] }> {
    const errors: string[] = [];
    
    if (!navigator.onLine) {
      return { success: false, errors: ['Client is offline'] };
    }

    console.log('[SyncService] Refreshing data from cloud...');

    try {
      await QuotationRepository.pullHistoryAndSequence();
      console.log('[SyncService] Quotations refreshed');
    } catch (e) {
      console.error('[SyncService] Quotations refresh failed:', e);
      errors.push('History refresh failed');
    }

    try {
      await CustomerRepository.pullFromCloud();
      console.log('[SyncService] Customers refreshed');
    } catch (e) {
      console.error('[SyncService] Customers refresh failed:', e);
      errors.push('Customers refresh failed');
    }

    try {
      await BookingRepository.pullBookingsAndSequence();
      console.log('[SyncService] Bookings refreshed');
    } catch (e) {
      console.error('[SyncService] Bookings refresh failed:', e);
      errors.push('Bookings refresh failed');
    }

    return { success: errors.length === 0, errors };
  },

  registerConnectionListeners(): () => void {
    const handleOnline = () => {
      console.log('[SyncService] Network online detected. Refreshing data...');
      SyncService.fullSync();
    };

    window.addEventListener('online', handleOnline);

    if (navigator.onLine) {
      SyncService.fullSync();
    }

    return () => {
      window.removeEventListener('online', handleOnline);
    };
  }
};
