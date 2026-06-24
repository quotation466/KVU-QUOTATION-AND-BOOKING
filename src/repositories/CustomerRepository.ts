import { SupabaseService } from '../services/SupabaseService';

export interface Customer {
  name: string;
  gender?: 'male' | 'female' | string;
  father?: string;
  address?: string;
  post?: string;
  district?: string;
  state?: string;
  pincode?: string;
  mobile?: string;
  aadhar?: string;
  gstin?: string;
  savedAt: string;
}

export const CustomerRepository = {
  async getCustomers(): Promise<Customer[]> {
    if (navigator.onLine) {
      const list = await SupabaseService.pullAllCustomers();
      if (list !== null) {
        localStorage.setItem('kvu_customers', JSON.stringify(list));
        return list;
      }
    }
    const cached = localStorage.getItem('kvu_customers');
    return cached ? JSON.parse(cached) : [];
  },

  async saveCustomer(customer: Customer): Promise<Customer[]> {
    const updatedCustomer = { ...customer, savedAt: new Date().toISOString() };
    if (navigator.onLine) {
      await SupabaseService.upsertCustomer(updatedCustomer);
    }
    const list = await this.getCustomers();
    const existingIdx = list.findIndex(c => c.name === updatedCustomer.name && (c.mobile || '') === (updatedCustomer.mobile || ''));
    let updatedList: Customer[];
    if (existingIdx !== -1) {
      updatedList = [...list];
      updatedList[existingIdx] = updatedCustomer;
    } else {
      updatedList = [updatedCustomer, ...list];
    }
    localStorage.setItem('kvu_customers', JSON.stringify(updatedList));
    return updatedList;
  },

  async deleteCustomer(_index: number, name?: string, mobile?: string): Promise<Customer[]> {
    if (name) {
      if (navigator.onLine) {
        await SupabaseService.softDeleteCustomer(name, mobile || '');
      }
      const list = await this.getCustomers();
      const updated = list.filter(c => !(c.name === name && (c.mobile || '') === (mobile || '')));
      localStorage.setItem('kvu_customers', JSON.stringify(updated));
      return updated;
    }
    return this.getCustomers();
  },

  async pullFromCloud(): Promise<Customer[] | null> {
    return this.getCustomers();
  }
};
