import type { Customer } from '../repositories/CustomerRepository';

export const CustomerService = {
  // Filter customers by search term
  filterCustomers: (customers: Customer[], query: string): Customer[] => {
    const q = query.trim().toLowerCase();
    if (!q) return customers;

    return customers.filter(
      (c) =>
        (c.name || '').toLowerCase().includes(q) ||
        (c.district || '').toLowerCase().includes(q) ||
        (c.mobile || '').includes(q)
    );
  },

  // Export customer list to CSV format
  exportToCsv: (customers: Customer[]): boolean => {
    if (!customers.length) return false;

    const headers = [
      'Name',
      "Father's Name",
      'Address',
      'Post',
      'District',
      'State',
      'Pincode',
      'Mobile',
      'Aadhar',
      'GSTIN'
    ];

    const csvRows = [headers.map((h) => `"${h.replace(/"/g, '""')}"`).join(',')];

    customers.forEach((c) => {
      const row = [
        c.name || '',
        c.father || '',
        c.address || '',
        c.post || '',
        c.district || '',
        c.state || '',
        c.pincode || '',
        c.mobile || '',
        c.aadhar || '',
        c.gstin || ''
      ];
      csvRows.push(row.map((val) => `"${String(val).replace(/"/g, '""')}"`).join(','));
    });

    const csvString = '\ufeff' + csvRows.join('\n');
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    
    const dateStr = new Date().toISOString().slice(0, 10);
    link.setAttribute('download', `KVU_Customers_${dateStr}.csv`);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    return true;
  }
};
