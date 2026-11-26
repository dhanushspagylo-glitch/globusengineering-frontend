'use client';

import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { RootState, AppDispatch } from '@/redux/store';
import { createPurchaseBill, updatePurchaseBill } from '@/redux/features/purchaseSlice';
import { fetchVendors } from '@/redux/features/vendorSlice';
import { fetchCustomers } from '@/redux/features/customerSlice';
import { PurchaseBill } from '@/types/modules';
import StatusModal from '@/components/StatusModal';

interface PurchaseFormProps {
  initialData?: PurchaseBill | null;
  isOpen: boolean;
  mode?: 'create' | 'edit' | 'view';
  onClose: () => void;
}

const PurchaseForm: React.FC<PurchaseFormProps> = ({ initialData, isOpen, mode = 'create', onClose }) => {
  const dispatch = useDispatch<AppDispatch>();
  const { company: activeCompany } = useSelector((state: RootState) => state.auth);
  const { items: vendors } = useSelector((state: RootState) => state.vendors);
  const { items: customers } = useSelector((state: RootState) => state.customers);

  const [formData, setFormData] = useState({
    receivedDate: '',
    companyName: '',
    gstTin: '',
    dcNo: '',
    invoiceNo: '',
    sac: '',
    qty: '',
    amount: '',
    cgst: '',
    sgst: '',
    igst: 0,
    roundOff: 0,
    tds: 0,
    vendorId: '',
    customerId: '',
    description: '',
    paymentMode: 'Cash',
    status: 'PAID' as 'PAID' | 'UNPAID'
  });

  const [errorMsg, setErrorMsg] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [statusModal, setStatusModal] = useState<{
    isOpen: boolean;
    type: 'success' | 'error' | 'warning' | 'info';
    title: string;
    message: string;
  }>({
    isOpen: false,
    type: 'error',
    title: '',
    message: ''
  });

  useEffect(() => {
    if (activeCompany?.id) {
      dispatch(fetchVendors({ company_id: activeCompany.id, limit: 1000 }));
      dispatch(fetchCustomers({ company_id: activeCompany.id, limit: 1000 }));
    }
  }, [dispatch, activeCompany?.id]);

  useEffect(() => {
    if (initialData) {
      setFormData({
        receivedDate: initialData.receivedDate ? new Date(initialData.receivedDate).toISOString().split('T')[0] : '',
        companyName: initialData.companyName || '',
        gstTin: initialData.gstTin || '',
        dcNo: initialData.dcNo || '',
        invoiceNo: initialData.invoiceNo || '',
        sac: initialData.sac || '',
        qty: initialData.qty?.toString() || '0',
        amount: initialData.amount?.toString() || '0',
        cgst: initialData.cgst?.toString() || '0',
        sgst: initialData.sgst?.toString() || '0',
        igst: initialData.igst || 0,
        roundOff: initialData.roundOff || 0,
        tds: initialData.tds || 0,
        vendorId: initialData.vendorId || '',
        customerId: initialData.customerId || '',
        description: initialData.description || '',
        paymentMode: initialData.paymentMode || 'Cash',
        status: (initialData.status === 'UNPAID' ? 'UNPAID' : 'PAID') as 'PAID' | 'UNPAID'
      });
    } else {
      setFormData({
        receivedDate: new Date().toISOString().split('T')[0],
        companyName: '',
        gstTin: '',
        dcNo: '',
        invoiceNo: '',
        sac: '',
        qty: '',
        amount: '',
        cgst: '',
        sgst: '',
        igst: 0,
        roundOff: 0,
        tds: 0,
        vendorId: '',
        customerId: '',
        description: '',
        paymentMode: 'Cash',
        status: 'PAID'
      });
    }
    setErrorMsg('');
  }, [initialData, isOpen]);

  if (!isOpen) return null;

  // Handle manual field change
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    if (name === 'status') {
      const newStatus = value as 'PAID' | 'UNPAID';
      setFormData(prev => ({
        ...prev,
        status: newStatus,
        paymentMode: newStatus === 'UNPAID' && prev.paymentMode === 'Cash' 
          ? 'Credit/Unpaid' 
          : (newStatus === 'PAID' && prev.paymentMode === 'Credit/Unpaid' ? 'Cash' : prev.paymentMode)
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: value
      }));
    }
  };

  // Handle vendor/customer selection
  const handlePartySelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    
    if (!value) {
      setFormData(prev => ({ 
        ...prev, 
        vendorId: '',
        customerId: '',
        companyName: '',
        gstTin: ''
      }));
      return;
    }

    const type = value.startsWith('vendor_') ? 'vendor' : value.startsWith('customer_') ? 'customer' : '';
    const id = value.replace(`${type}_`, '');

    if (type === 'vendor') {
      const selectedVendor = vendors.find(v => String(v.id) === id);
      if (selectedVendor) {
        setFormData(prev => ({
          ...prev,
          vendorId: id,
          customerId: '',
          companyName: selectedVendor.name || '',
          gstTin: selectedVendor.gst || ''
        }));
      }
    } else if (type === 'customer') {
      const selectedCustomer = customers.find(c => String(c.id) === id);
      if (selectedCustomer) {
        setFormData(prev => ({
          ...prev,
          vendorId: '',
          customerId: id,
          companyName: selectedCustomer.name || '',
          gstTin: selectedCustomer.gst || ''
        }));
      }
    }
  };

  // Auto-calculated Grand Total
  const qtyNum = Number(formData.qty) || 0;
  const amountNum = Number(formData.amount) || 0;
  const cgstNum = Number(formData.cgst) || 0;
  const sgstNum = Number(formData.sgst) || 0;
  const igstNum = Number(formData.igst) || 0;
  const roundOffNum = Number(formData.roundOff) || 0;
  const tdsNum = Number(formData.tds) || 0;
  const grandTotal = Math.max(0, Number((amountNum + cgstNum + sgstNum + igstNum + roundOffNum - tdsNum).toFixed(2)));

  // Real-time CGST/SGST calculator helper
  const applyGstRate = (ratePercent: number) => {
    const halfRate = ratePercent / 2;
    const computedCgst = Number(((amountNum * halfRate) / 100).toFixed(2));
    const computedSgst = Number(((amountNum * halfRate) / 100).toFixed(2));
    
    const rawTotal = amountNum + computedCgst + computedSgst;
    const roundedTotal = Math.round(rawTotal);
    const computedRoundOff = Number((roundedTotal - rawTotal).toFixed(2));

    setFormData(prev => ({
      ...prev,
      cgst: computedCgst.toFixed(2),
      sgst: computedSgst.toFixed(2),
      igst: 0,
      roundOff: computedRoundOff
    }));
  };

  const applyIgstRate = (ratePercent: number) => {
    const computedIgst = Number(((amountNum * ratePercent) / 100).toFixed(2));
    
    const rawTotal = amountNum + computedIgst;
    const roundedTotal = Math.round(rawTotal);
    const computedRoundOff = Number((roundedTotal - rawTotal).toFixed(2));

    setFormData(prev => ({
      ...prev,
      cgst: '0',
      sgst: '0',
      igst: computedIgst,
      roundOff: computedRoundOff
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.companyName) {
      setStatusModal({
        isOpen: true,
        type: 'error',
        title: 'Vendor Required',
        message: 'Please enter or select the Vendor / Company Name.'
      });
      return;
    }

    if (!formData.invoiceNo) {
      setStatusModal({
        isOpen: true,
        type: 'error',
        title: 'Invoice Number Required',
        message: 'Please enter the Purchase Invoice Number.'
      });
      return;
    }

    if (!formData.receivedDate) {
      setStatusModal({
        isOpen: true,
        type: 'error',
        title: 'Received Date Required',
        message: 'Please select the Received Date.'
      });
      return;
    }

    if (amountNum <= 0) {
      setStatusModal({
        isOpen: true,
        type: 'error',
        title: 'Enter Price Amount',
        message: 'Please enter the purchase bill amount.'
      });
      return;
    }

    setSubmitting(true);
    setErrorMsg('');

    const payload = {
      receivedDate: formData.receivedDate,
      companyName: formData.companyName,
      gstTin: formData.gstTin || undefined,
      dcNo: formData.dcNo || undefined,
      invoiceNo: formData.invoiceNo,
      sac: formData.sac || undefined,
      qty: qtyNum,
      amount: amountNum,
      cgst: cgstNum,
      sgst: sgstNum,
      igst: igstNum,
      roundOff: roundOffNum,
      tds: tdsNum,
      grandTotal: Number(grandTotal.toFixed(2)),
      vendorId: formData.vendorId || undefined,
      customerId: formData.customerId || undefined,
      description: formData.description?.trim() || undefined,
      paymentMode: formData.paymentMode,
      status: formData.status,
      company_id: activeCompany?.id
    };

    try {
      if (initialData) {
        await dispatch(updatePurchaseBill({ ...payload, id: initialData.id } as PurchaseBill)).unwrap();
      } else {
        await dispatch(createPurchaseBill(payload)).unwrap();
      }
      onClose();
    } catch (err: any) {
      setErrorMsg(err || 'Failed to save purchase bill entry');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal d-block" tabIndex={-1} style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1050 }}>
      <div className="modal-dialog modal-lg modal-dialog-centered">
        <div className="modal-content rounded-4 border-0 shadow-lg">
          <div className="modal-header border-bottom-0 p-4">
            <h5 className="modal-title fw-bold text-dark fs-4">
              {mode === 'view' ? 'View Purchase Bill' : initialData ? 'Edit Purchase Bill' : 'New Purchase Bill Entry'}
            </h5>
            <button type="button" className="btn-close shadow-none" onClick={onClose} aria-label="Close"></button>
          </div>
          
          <form onSubmit={handleSubmit}>
            <div className="modal-body px-4 py-0" style={{ maxHeight: 'calc(100vh - 210px)', overflowY: 'auto' }}>
              {errorMsg && (
                <div className="alert alert-danger rounded-3 py-2 px-3 small border-0 mb-4 animate-fade-in">
                  <i className="bi bi-exclamation-triangle-fill me-2"></i>
                  {errorMsg}
                </div>
              )}

              <div className="row g-3">
                {/* Received Date */}
                <div className="col-md-6">
                  <label className="form-label text-muted small fw-bold text-uppercase">Received Date *</label>
                  <input
                    type="date"
                    name="receivedDate"
                    className="form-control rounded-3 border-light-subtle shadow-none py-2"
                    value={formData.receivedDate}
                    onChange={handleChange}
                    disabled={mode === 'view'}
                    required
                  />
                </div>

                {/* Party Select */}
                <div className="col-md-6">
                  <label className="form-label text-muted small fw-bold text-uppercase">Party Source (Optional)</label>
                  <select
                    className="form-select rounded-3 border-light-subtle shadow-none py-2"
                    value={formData.vendorId ? `vendor_${formData.vendorId}` : (formData.customerId ? `customer_${formData.customerId}` : '')}
                    onChange={handlePartySelect}
                    disabled={mode === 'view'}
                  >
                    <option value="">Direct / Outside Purchase (Type Name Below)</option>
                    <optgroup label="Saved Vendors">
                      {vendors.map(v => (
                        <option key={`vendor_${v.id}`} value={`vendor_${v.id}`}>{v.name} {v.company ? `(${v.company})` : ''}</option>
                      ))}
                    </optgroup>
                    <optgroup label="Saved Customers">
                      {customers.map(c => (
                        <option key={`customer_${c.id}`} value={`customer_${c.id}`}>{c.name} {c.company ? `(${c.company})` : ''}</option>
                      ))}
                    </optgroup>
                  </select>
                </div>

                {/* Vendor / Supplier / Shop Name */}
                <div className="col-md-6">
                  <label className="form-label text-muted small fw-bold text-uppercase">Vendor / Supplier / Shop Name *</label>
                  <input
                    type="text"
                    name="companyName"
                    className="form-control rounded-3 border-light-subtle shadow-none py-2"
                    placeholder="Enter shop, vendor, or outside supplier name"
                    value={formData.companyName}
                    onChange={handleChange}
                    disabled={mode === 'view'}
                    required
                  />
                </div>

                {/* GST TIN */}
                <div className="col-md-6">
                  <label className="form-label text-muted small fw-bold text-uppercase">GST TIN</label>
                  <input
                    type="text"
                    name="gstTin"
                    className="form-control rounded-3 border-light-subtle shadow-none py-2"
                    placeholder="22AAAAA0000A1Z5"
                    value={formData.gstTin}
                    onChange={handleChange}
                    disabled={mode === 'view'}
                  />
                </div>

                {/* D.C No */}
                <div className="col-md-6">
                  <label className="form-label text-muted small fw-bold text-uppercase">D.C No</label>
                  <input
                    type="text"
                    name="dcNo"
                    className="form-control rounded-3 border-light-subtle shadow-none py-2"
                    placeholder="Delivery Challan Number"
                    value={formData.dcNo}
                    onChange={handleChange}
                    disabled={mode === 'view'}
                  />
                </div>

                {/* Invoice No */}
                <div className="col-md-6">
                  <label className="form-label text-muted small fw-bold text-uppercase">Invoice No *</label>
                  <input
                    type="text"
                    name="invoiceNo"
                    className="form-control rounded-3 border-light-subtle shadow-none py-2"
                    placeholder="Invoice Number"
                    value={formData.invoiceNo}
                    onChange={handleChange}
                    disabled={mode === 'view'}
                    required
                  />
                </div>

                {/* Item / Material Name / Purpose */}
                <div className="col-12">
                  <label className="form-label text-muted small fw-bold text-uppercase">Item / Material / Purpose (What was purchased) *</label>
                  <input
                    type="text"
                    name="description"
                    className="form-control rounded-3 border-light-subtle shadow-none py-2"
                    placeholder="e.g. Office Stationery, Machine Tools, Raw Material, Hardware Items, Local Purchase"
                    value={formData.description}
                    onChange={handleChange}
                    disabled={mode === 'view'}
                  />
                </div>

                {/* SAC Code */}
                <div className="col-md-4">
                  <label className="form-label text-muted small fw-bold text-uppercase">SAC / HSN</label>
                  <input
                    type="text"
                    name="sac"
                    className="form-control rounded-3 border-light-subtle shadow-none py-2"
                    placeholder="SAC code"
                    value={formData.sac}
                    onChange={handleChange}
                    disabled={mode === 'view'}
                  />
                </div>

                {/* Qty */}
                <div className="col-md-4">
                  <label className="form-label text-muted small fw-bold text-uppercase">Quantity</label>
                  <input
                    type="number"
                    step="any"
                    name="qty"
                    className="form-control rounded-3 border-light-subtle shadow-none py-2"
                    placeholder="0.00"
                    value={formData.qty}
                    onChange={handleChange}
                    disabled={mode === 'view'}
                  />
                </div>

                {/* Taxable Amount */}
                <div className="col-md-4">
                  <label className="form-label text-muted small fw-bold text-uppercase">Amount (Taxable Value)</label>
                  <input
                    type="number"
                    step="any"
                    name="amount"
                    className="form-control rounded-3 border-light-subtle shadow-none py-2"
                    placeholder="0.00"
                    value={formData.amount}
                    onChange={handleChange}
                    disabled={mode === 'view'}
                  />
                </div>

                {/* Quick GST Actions */}
                {mode !== 'view' && (
                  <div className="col-12 py-1">
                    <div className="d-flex align-items-center gap-2 flex-wrap">
                      <span className="text-muted small fw-bold me-2">Calculate GST:</span>
                      <button type="button" className="btn btn-sm btn-outline-secondary rounded-pill px-3" onClick={() => applyGstRate(12)}>CGST+SGST @ 12%</button>
                      <button type="button" className="btn btn-sm btn-outline-secondary rounded-pill px-3" onClick={() => applyGstRate(18)}>CGST+SGST @ 18%</button>
                      <button type="button" className="btn btn-sm btn-outline-secondary rounded-pill px-3" onClick={() => applyIgstRate(12)}>IGST @ 12%</button>
                      <button type="button" className="btn btn-sm btn-outline-secondary rounded-pill px-3" onClick={() => applyIgstRate(18)}>IGST @ 18%</button>
                    </div>
                  </div>
                )}

                {/* CGST */}
                <div className="col-md-3">
                  <label className="form-label text-danger-emphasis small fw-bold text-uppercase">CGST</label>
                  <input
                    type="number"
                    step="any"
                    name="cgst"
                    className="form-control rounded-3 border-light-subtle shadow-none py-2 text-danger-emphasis"
                    placeholder="0.00"
                    value={formData.cgst}
                    onChange={handleChange}
                    disabled={mode === 'view'}
                  />
                </div>

                {/* SGST */}
                <div className="col-md-3">
                  <label className="form-label text-danger-emphasis small fw-bold text-uppercase">SGST</label>
                  <input
                    type="number"
                    step="any"
                    name="sgst"
                    className="form-control rounded-3 border-light-subtle shadow-none py-2 text-danger-emphasis"
                    placeholder="0.00"
                    value={formData.sgst}
                    onChange={handleChange}
                    disabled={mode === 'view'}
                  />
                </div>

                {/* IGST */}
                <div className="col-md-3">
                  <label className="form-label text-danger-emphasis small fw-bold text-uppercase">IGST</label>
                  <input
                    type="number"
                    step="any"
                    name="igst"
                    className="form-control rounded-3 border-light-subtle shadow-none py-2 text-danger-emphasis"
                    placeholder="0.00"
                    value={formData.igst}
                    onChange={handleChange}
                    disabled={mode === 'view'}
                  />
                </div>

                {/* Round Off */}
                <div className="col-md-3">
                  <label className="form-label text-danger-emphasis small fw-bold text-uppercase">Round Off</label>
                  <input
                    type="number"
                    step="any"
                    name="roundOff"
                    className="form-control rounded-3 border-light-subtle shadow-none py-2 text-danger-emphasis"
                    placeholder="0.00"
                    value={formData.roundOff}
                    onChange={handleChange}
                    disabled={mode === 'view'}
                  />
                </div>

                {/* TDS */}
                <div className="col-md-4">
                  <label className="form-label text-danger-emphasis small fw-bold text-uppercase">TDS (-)</label>
                  <input
                    type="number"
                    step="any"
                    name="tds"
                    className="form-control rounded-3 border-light-subtle shadow-none py-2 text-danger-emphasis"
                    placeholder="0.00"
                    value={formData.tds}
                    onChange={handleChange}
                    disabled={mode === 'view'}
                  />
                </div>

                {/* Status */}
                <div className="col-md-4">
                  <label className="form-label text-muted small fw-bold text-uppercase">Payment Status *</label>
                  <select
                    name="status"
                    className={`form-select rounded-3 border-light-subtle shadow-none py-2 fw-bold ${formData.status === 'PAID' ? 'text-success' : 'text-danger'}`}
                    value={formData.status}
                    onChange={handleChange}
                    disabled={mode === 'view'}
                  >
                    <option value="PAID">PAID</option>
                    <option value="UNPAID">UNPAID</option>
                  </select>
                </div>

                {/* Payment Mode */}
                <div className="col-md-4">
                  <label className="form-label text-muted small fw-bold text-uppercase">Payment Mode</label>
                  <select
                    name="paymentMode"
                    className="form-select rounded-3 border-light-subtle shadow-none py-2"
                    value={formData.paymentMode}
                    onChange={handleChange}
                    disabled={mode === 'view'}
                  >
                    <option value="Cash">Cash</option>
                    <option value="Bank Transfer">Bank Transfer</option>
                    <option value="UPI">UPI</option>
                    <option value="Cheque">Cheque</option>
                    <option value="Credit/Unpaid">Credit/Unpaid</option>
                  </select>
                </div>
              </div>

              {/* Dynamic Grand Total summary */}
              <div className="bg-light-subtle p-3 rounded-4 border border-light-subtle mt-4 d-flex justify-content-between align-items-center">
                <div>
                  <span className="text-muted small fw-bold text-uppercase d-block">Grand Total</span>
                  <span className="text-dark-emphasis small font-monospace">Taxable Value + Taxes + Round Off - TDS</span>
                </div>
                <div className="h3 fw-bold text-primary mb-0 font-monospace">
                  ₹{grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>
            </div>

            <div className="modal-footer border-top-0 p-4">
              <button type="button" className="btn btn-light rounded-3 px-4 shadow-none" onClick={onClose} disabled={submitting}>
                {mode === 'view' ? 'Close' : 'Cancel'}
              </button>
              {mode !== 'view' && (
                <button type="submit" className="btn btn-primary rounded-3 px-4 shadow-none btn-page-action" disabled={submitting}>
                  {submitting ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                      Saving...
                    </>
                  ) : (
                    'Save Bill'
                  )}
                </button>
              )}
            </div>
          </form>
        </div>
      </div>
      <StatusModal
        isOpen={statusModal.isOpen}
        type={statusModal.type}
        title={statusModal.title}
        message={statusModal.message}
        onClose={() => setStatusModal(prev => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
};

export default PurchaseForm;
