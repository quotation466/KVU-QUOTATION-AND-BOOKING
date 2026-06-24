const ones = [
  '',
  'One',
  'Two',
  'Three',
  'Four',
  'Five',
  'Six',
  'Seven',
  'Eight',
  'Nine',
  'Ten',
  'Eleven',
  'Twelve',
  'Thirteen',
  'Fourteen',
  'Fifteen',
  'Sixteen',
  'Seventeen',
  'Eighteen',
  'Nineteen'
];

const tensW = [
  '',
  '',
  'Twenty',
  'Thirty',
  'Forty',
  'Fifty',
  'Sixty',
  'Seventy',
  'Eighty',
  'Ninety'
];

export function numToWords(n: number): string {
  if (n === 0) return 'Zero';
  let w = '';
  if (Math.floor(n / 10000000) > 0) {
    w += numToWords(Math.floor(n / 10000000)) + ' Crore ';
    n %= 10000000;
  }
  if (Math.floor(n / 100000) > 0) {
    w += numToWords(Math.floor(n / 100000)) + ' Lakh ';
    n %= 100000;
  }
  if (Math.floor(n / 1000) > 0) {
    w += numToWords(Math.floor(n / 1000)) + ' Thousand ';
    n %= 1000;
  }
  if (Math.floor(n / 100) > 0) {
    w += numToWords(Math.floor(n / 100)) + ' Hundred ';
    n %= 100;
  }
  if (n > 0) {
    if (n < 20) {
      w += ones[n];
    } else {
      w += tensW[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '');
    }
  }
  return w.trim();
}

export function numberToWords(n: number): string {
  return numToWords(Math.floor(n)) + ' Rupees Only';
}

export function formatCurrency(n: number): string {
  if (isNaN(n)) return '0.00';
  return n.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}
