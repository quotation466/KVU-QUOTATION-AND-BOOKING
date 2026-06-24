import { useState, useEffect } from 'react';
import { CustomerRepository } from '../repositories/CustomerRepository';
import type { Customer } from '../repositories/CustomerRepository';
import { CustomerService } from '../services/CustomerService';

export const useCustomers = () => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');

  useEffect(() => {
    pullCustomers();
  }, []);

  const pullCustomers = async () => {
    setLoading(true);
    const cloud = await CustomerRepository.pullFromCloud();
    if (cloud) {
      setCustomers(cloud);
    }
    setLoading(false);
  };

  const saveCustomer = async (customer: Customer) => {
    setLoading(true);
    const updated = await CustomerRepository.saveCustomer(customer);
    setCustomers(updated);
    setLoading(false);
  };

  const deleteCustomer = async (index: number, name?: string, mobile?: string) => {
    setLoading(true);
    const updated = await CustomerRepository.deleteCustomer(index, name, mobile);
    setCustomers(updated);
    setLoading(false);
  };

  const exportCustomers = () => {
    return CustomerService.exportToCsv(customers);
  };

  const filteredCustomers = CustomerService.filterCustomers(customers, searchQuery);

  return {
    customers,
    filteredCustomers,
    loading,
    searchQuery,
    setSearchQuery,
    saveCustomer,
    deleteCustomer,
    pullCustomers,
    exportCustomers
  };
};
