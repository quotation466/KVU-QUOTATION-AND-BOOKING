import React, { useState, useEffect } from 'react';

// General Form Group Wrapper
interface FormGroupProps {
  label: React.ReactNode;
  required?: boolean;
  children: React.ReactNode;
  errorMessage?: string;
  style?: React.CSSProperties;
}

export const FormGroup: React.FC<FormGroupProps> = ({
  label,
  required = false,
  children,
  errorMessage,
  style
}) => {
  return (
    <div className="form-group" style={style}>
      <label>
        {label} {required && <span style={{ color: 'red' }}>*</span>}
      </label>
      {children}
      {errorMessage && (
        <div className="val-msg error" style={{ display: 'block' }}>
          {errorMessage}
        </div>
      )}
    </div>
  );
};

// Generic Input component
interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  value: string;
  onChange: (val: string) => void;
}

export const Input: React.FC<InputProps> = ({ value, onChange, className = '', type = 'text', ...props }) => {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={className}
      {...props}
    />
  );
};

// Generic Select component
interface SelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'onChange'> {
  value: string;
  onChange: (val: string) => void;
  options: { value: string; label: string }[];
}

export const Select: React.FC<SelectProps> = ({ value, onChange, options, ...props }) => {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} {...props}>
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
};

// Mobile Number Input with integrated validation
interface ValidatedInputProps {
  value: string;
  onChange: (val: string) => void;
  id?: string;
  placeholder?: string;
  disabled?: boolean;
}

export const MobileInput: React.FC<ValidatedInputProps> = ({
  value,
  onChange,
  id,
  placeholder = 'Enter Mobile Number',
  disabled = false
}) => {
  const [status, setStatus] = useState<{ type: 'ok' | 'error' | 'none'; msg: string }>({
    type: 'none',
    msg: ''
  });

  const validate = (val: string) => {
    const raw = val.replace(/\D/g, '').substring(0, 10);
    const len = raw.length;

    if (len === 0) {
      return { val: '', type: 'none' as const, msg: '' };
    }

    if (len < 10) {
      return {
        val: raw,
        type: 'error' as const,
        msg: `⚠️ ${len}/10 digits entered — ${10 - len} more needed`
      };
    }

    if (!/^[6-9]/.test(raw)) {
      return {
        val: raw,
        type: 'error' as const,
        msg: '❌ Invalid — must start with 6, 7, 8 or 9'
      };
    }

    return {
      val: raw,
      type: 'ok' as const,
      msg: '✅ Valid mobile number'
    };
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const res = validate(e.target.value);
    onChange(res.val);
  };

  useEffect(() => {
    const res = validate(value);
    setStatus({ type: res.type, msg: res.msg });
  }, [value]);

  const inputClass = status.type === 'ok' ? 'inp-ok' : status.type === 'error' ? 'inp-error' : '';

  return (
    <div className="autocomplete-wrap" style={{ position: 'relative', width: '100%' }}>
      <input
        type="text"
        id={id}
        value={value}
        onChange={handleChange}
        placeholder={placeholder}
        className={inputClass}
        disabled={disabled}
      />
      {status.msg && (
        <div className={`val-msg ${status.type === 'ok' ? 'ok' : 'error'}`}>
          {status.msg}
        </div>
      )}
    </div>
  );
};

// Aadhaar Number Input with spacing (XXXX XXXX XXXX) and validation
export const AadhaarInput: React.FC<ValidatedInputProps> = ({
  value,
  onChange,
  id,
  placeholder = '0000 0000 0000',
  disabled = false
}) => {
  const [status, setStatus] = useState<{ type: 'ok' | 'error' | 'none'; msg: string }>({
    type: 'none',
    msg: ''
  });

  const formatAndValidate = (val: string) => {
    const digits = val.replace(/\D/g, '').substring(0, 12);
    let formatted = '';
    for (let i = 0; i < digits.length; i++) {
      if (i === 4 || i === 8) formatted += ' ';
      formatted += digits[i];
    }

    const len = digits.length;
    if (len === 0) {
      return { val: '', type: 'none' as const, msg: '' };
    }

    if (len < 12) {
      return {
        val: formatted,
        type: 'error' as const,
        msg: `⚠️ ${len}/12 digits entered — ${12 - len} more needed`
      };
    }

    return {
      val: formatted,
      type: 'ok' as const,
      msg: '✅ Valid Aadhaar number'
    };
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const res = formatAndValidate(e.target.value);
    onChange(res.val);
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    const res = formatAndValidate(value);
    setStatus({ type: res.type, msg: res.msg });
  }, [value]);

  const inputClass = status.type === 'ok' ? 'inp-ok' : status.type === 'error' ? 'inp-error' : '';

  return (
    <div className="autocomplete-wrap" style={{ position: 'relative', width: '100%' }}>
      <input
        type="text"
        id={id}
        value={value}
        onChange={handleChange}
        placeholder={placeholder}
        className={inputClass}
        disabled={disabled}
      />
      {status.msg && (
        <div className={`val-msg ${status.type === 'ok' ? 'ok' : 'error'}`}>
          {status.msg}
        </div>
      )}
    </div>
  );
};

// GSTIN Input with capitalization and format validation
export const GstinInput: React.FC<ValidatedInputProps> = ({
  value,
  onChange,
  id,
  placeholder = 'Enter GSTIN (e.g., 09ABCDE1234F1Z5)',
  disabled = false
}) => {
  const [status, setStatus] = useState<{ type: 'ok' | 'error' | 'none'; msg: string }>({
    type: 'none',
    msg: ''
  });

  const validate = (val: string) => {
    const raw = val.replace(/[^A-Za-z0-9]/g, '').substring(0, 15).toUpperCase();
    const len = raw.length;

    if (len === 0) {
      return { val: '', type: 'none' as const, msg: '' };
    }

    const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

    if (len < 15) {
      return {
        val: raw,
        type: 'error' as const,
        msg: `⚠️ ${len}/15 characters entered — ${15 - len} more needed`
      };
    }

    if (!gstinRegex.test(raw)) {
      return {
        val: raw,
        type: 'error' as const,
        msg: '❌ Invalid GSTIN format (e.g. 09ABCDE1234F1Z5)'
      };
    }

    return {
      val: raw,
      type: 'ok' as const,
      msg: '✅ Valid GSTIN'
    };
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const res = validate(e.target.value);
    onChange(res.val);
  };

  useEffect(() => {
    const res = validate(value);
    setStatus({ type: res.type, msg: res.msg });
  }, [value]);

  const inputClass = status.type === 'ok' ? 'inp-ok' : status.type === 'error' ? 'inp-error' : '';

  return (
    <div className="autocomplete-wrap" style={{ position: 'relative', width: '100%' }}>
      <input
        type="text"
        id={id}
        value={value}
        onChange={handleChange}
        placeholder={placeholder}
        className={inputClass}
        disabled={disabled}
      />
      {status.msg && (
        <div className={`val-msg ${status.type === 'ok' ? 'ok' : 'error'}`}>
          {status.msg}
        </div>
      )}
    </div>
  );
};
