import React, { useState, useEffect } from 'react';
import type { Customer } from '../repositories/CustomerRepository';
import { FormGroup, Input, MobileInput, AadhaarInput, GstinInput, Select } from '../components/FormControls';
import { Button } from '../components/Button';
import { getStatesList, getDistrictsForState } from '../utils/indiaDistricts';

interface CustomerFormProps {
  initialCustomer: Customer | null;
  onSave: (customer: Customer) => void;
  onCancel: () => void;
}

export const CustomerForm: React.FC<CustomerFormProps> = ({
  initialCustomer,
  onSave,
  onCancel
}) => {
  const [name, setName] = useState('');
  const [father, setFather] = useState('');
  const [address, setAddress] = useState('');
  const [post, setPost] = useState('');
  const [state, setState] = useState('');
  const [district, setDistrict] = useState('');
  const [pincode, setPincode] = useState('');
  const [mobile, setMobile] = useState('');
  const [aadhar, setAadhar] = useState('');
  const [gstin, setGstin] = useState('');

  const [districtsList, setDistrictsList] = useState<string[]>([]);
  const [loadingDistricts, setLoadingDistricts] = useState(false);

  // States List
  const statesList = getStatesList().map(s => ({ value: s, label: s }));
  const statesOptions = [{ value: '', label: '-- Select State --' }, ...statesList];

  useEffect(() => {
    if (initialCustomer) {
      setName(initialCustomer.name || '');
      setFather(initialCustomer.father || '');
      setAddress(initialCustomer.address || '');
      setPost(initialCustomer.post || '');
      setState(initialCustomer.state || '');
      setDistrict(initialCustomer.district || '');
      setPincode(initialCustomer.pincode || '');
      setMobile(initialCustomer.mobile || '');
      setAadhar(initialCustomer.aadhar || '');
      setGstin(initialCustomer.gstin || '');
    } else {
      setName('');
      setFather('');
      setAddress('');
      setPost('');
      setState('');
      setDistrict('');
      setPincode('');
      setMobile('');
      setAadhar('');
      setGstin('');
    }
  }, [initialCustomer]);

  // Load districts dynamically when state changes
  useEffect(() => {
    const loadDistricts = async () => {
      if (state) {
        setLoadingDistricts(true);
        const list = await getDistrictsForState(state);
        setDistrictsList(list);
        
        // If this state change matches the initial customer state, restore initial district
        if (initialCustomer && initialCustomer.state === state && list.includes(initialCustomer.district || '')) {
          setDistrict(initialCustomer.district || '');
        } else {
          // Otherwise, if the current district is not in the new state's districts, reset it
          if (!list.includes(district)) {
            setDistrict('');
          }
        }
        setLoadingDistricts(false);
      } else {
        setDistrictsList([]);
        setDistrict('');
      }
    };
    loadDistricts();
  }, [state, initialCustomer]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      alert('Customer Name is required!');
      return;
    }

    const cleanMobile = mobile.replace(/\D/g, '');
    const cleanAadhar = aadhar.replace(/\D/g, '');
    const cleanGstin = gstin.trim().toUpperCase();

    if (cleanMobile.length > 0 && (cleanMobile.length !== 10 || !/^[6-9]/.test(cleanMobile))) {
      alert('Enter a valid 10-digit mobile number');
      return;
    }

    if (cleanAadhar.length > 0 && cleanAadhar.length !== 12) {
      alert('Enter a valid 12-digit Aadhaar number');
      return;
    }

    if (cleanGstin.length > 0) {
      const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
      if (!gstinRegex.test(cleanGstin)) {
        alert('Enter a valid 15-character GSTIN (e.g. 09ABCDE1234F1Z5)');
        return;
      }
    }

    const customerRecord: Customer = {
      name: name.trim(),
      father: father.trim(),
      address: address.trim(),
      post: post.trim(),
      district,
      state,
      pincode: pincode.trim(),
      mobile: mobile.trim(),
      aadhar: aadhar.trim(),
      gstin: cleanGstin,
      savedAt: new Date().toISOString()
    };

    onSave(customerRecord);
  };

  const districtOptions = [
    { value: '', label: state ? (loadingDistricts ? '⏳ Loading...' : '-- Select District --') : '-- Select State First --' },
    ...districtsList.slice().sort().map(d => ({ value: d, label: d }))
  ];

  return (
    <form onSubmit={handleSubmit} className="modal-payment-form">
      <FormGroup label="Customer Name *" required>
        <Input 
          value={name} 
          onChange={setName} 
          placeholder="Full Name" 
          required 
        />
      </FormGroup>

      <FormGroup label="Father's Name">
        <Input 
          value={father} 
          onChange={setFather} 
          placeholder="Father's Name" 
        />
      </FormGroup>

      <FormGroup label="Address">
        <Input 
          value={address} 
          onChange={setAddress} 
          placeholder="House No. / Street Name" 
        />
      </FormGroup>

      <FormGroup label="Post">
        <Input 
          value={post} 
          onChange={setPost} 
          placeholder="Post / Village" 
        />
      </FormGroup>

      <div style={{ display: 'flex', gap: '10px' }}>
        <FormGroup label="State" style={{ flex: 1 }}>
          <Select 
            value={state} 
            onChange={setState} 
            options={statesOptions} 
          />
        </FormGroup>

        <FormGroup label="District" style={{ flex: 1 }}>
          <Select 
            value={district} 
            onChange={setDistrict} 
            options={districtOptions} 
            disabled={!state || loadingDistricts}
          />
        </FormGroup>
      </div>

      <FormGroup label="Pincode">
        <Input 
          value={pincode} 
          onChange={setPincode} 
          placeholder="6-digit Pincode" 
          maxLength={6}
          pattern="\d{6}"
        />
      </FormGroup>

      <FormGroup label="Mobile Number">
        <MobileInput 
          value={mobile} 
          onChange={setMobile} 
          placeholder="10-digit Mobile Number" 
        />
      </FormGroup>

      <FormGroup label="Aadhaar Number">
        <AadhaarInput 
          value={aadhar} 
          onChange={setAadhar} 
          placeholder="0000 0000 0000" 
        />
      </FormGroup>

      <FormGroup label="GSTIN">
        <GstinInput 
          value={gstin} 
          onChange={setGstin} 
          placeholder="15-character GSTIN" 
        />
      </FormGroup>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
        <Button 
          type="button" 
          variant="outline" 
          onClick={onCancel}
        >
          Cancel
        </Button>
        <Button 
          type="submit" 
          variant="primary"
        >
          Save Customer
        </Button>
      </div>
    </form>
  );
};
