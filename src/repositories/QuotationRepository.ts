import { SupabaseService } from '../services/SupabaseService';
export type { LineItem } from '../types/LineItem';
import type { LineItem } from '../types/LineItem';

export interface Quotation {
  ref: string;
  date: string;
  dateVal: string;
  custName: string;
  gender: 'male' | 'female';
  relation: string;
  fatherName?: string;
  address?: string;
  post?: string;
  district?: string;
  state?: string;
  pincode?: string;
  mobile?: string;
  aadhar?: string;
  heading: string;
  hsn?: string;
  capacity?: string;
  power?: string;
  items: LineItem[];
  discount: number;
  gstRate: number;
  incInst: boolean;
  grandTotal: number;
  grandTotalFmt: string;
  savedAt: string;
}

export const QuotationRepository = {
  // Sequence
  async getSequence(): Promise<number> {
    if (navigator.onLine) {
      const seq = await SupabaseService.getSequence('quotation');
      if (seq !== null) {
        localStorage.setItem('kvu_quotation_sequence', String(seq));
        return seq;
      }
    }
    const cached = localStorage.getItem('kvu_quotation_sequence');
    return cached ? Number(cached) : 0;
  },

  async incrementSequence(): Promise<number> {
    if (navigator.onLine) {
      const next = await SupabaseService.incrementSequence('quotation');
      if (next !== null) {
        localStorage.setItem('kvu_quotation_sequence', String(next));
        return next;
      }
    }
    const cached = localStorage.getItem('kvu_quotation_sequence');
    const nextLocal = (cached ? Number(cached) : 0) + 1;
    localStorage.setItem('kvu_quotation_sequence', String(nextLocal));
    return nextLocal;
  },

  // History
  async getHistory(): Promise<Quotation[]> {
    if (navigator.onLine) {
      const list = await SupabaseService.pullAllQuotations();
      if (list !== null) {
        localStorage.setItem('kvu_quotation_history', JSON.stringify(list));
        return list;
      }
    }
    const cached = localStorage.getItem('kvu_quotation_history');
    return cached ? JSON.parse(cached) : [];
  },

  async saveQuotation(quote: Quotation, isEdit: boolean): Promise<{ history: Quotation[]; nextRefNum: number }> {
    const now = new Date().toISOString();
    let nextRefNum = await this.getSequence();
    const quoteToSave = { ...quote, savedAt: now };

    if (!isEdit) {
      nextRefNum = await this.incrementSequence();
    }

    if (navigator.onLine) {
      await SupabaseService.upsertQuotation(quoteToSave);
    }
    
    const history = await this.getHistory();
    let updatedHistory: Quotation[];
    const existingIdx = history.findIndex(q => q.ref === quoteToSave.ref);
    if (existingIdx !== -1) {
      updatedHistory = [...history];
      updatedHistory[existingIdx] = quoteToSave;
    } else {
      updatedHistory = [quoteToSave, ...history];
    }
    localStorage.setItem('kvu_quotation_history', JSON.stringify(updatedHistory));

    return { history: updatedHistory, nextRefNum };
  },

  async deleteQuotation(_index: number, ref?: string): Promise<Quotation[]> {
    if (ref) {
      if (navigator.onLine) {
        await SupabaseService.softDeleteQuotation(ref);
      }
      const history = await this.getHistory();
      const updated = history.filter(q => q.ref !== ref);
      localStorage.setItem('kvu_quotation_history', JSON.stringify(updated));
      return updated;
    }
    return this.getHistory();
  },

  async pullHistoryAndSequence(): Promise<{ history: Quotation[] | null; sequence: number | null }> {
    const history = await this.getHistory();
    const sequence = await this.getSequence();
    return { history, sequence };
  }
};
