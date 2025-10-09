import React, { useState, useEffect } from 'react';
import { useCompany } from '../../contexts/CompanyContext';
import axiosInstance from '../../axiosInstance';
import { X, Plus, Trash2 } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useSocket } from '../../contexts/SocketContext';
import { id } from 'date-fns/locale';

interface InvoiceItem {
  id?: number;
  product_id: number;
  product_name: string;
  description: string;
  quantity: number | '';
  unit_price: number;
  actual_unit_price: number;
  tax_rate: number;
  tax_amount: number;
  total_price: number;
}

interface Customer {
  id: number;
  name: string;
  shipping_address?: string;
  billing_address?: string;
}

interface TaxRate {
  tax_rate_id: number;
  company_id: number;
  name: string;
  rate: string;
  is_default: number;
  created_at: string;
}

interface Invoice {
  id: number;
  invoice_number: string;
  head_note?: string | null;
  customer_id: number;
  customer_name?: string;
  billing_address?: string;
  shipping_address?: string;
  employee_id: number;
  employee_name?: string;
  invoice_date: string;
  due_date: string;
  subtotal: number;
  discount_type: 'percentage' | 'fixed';
  discount_value: number;
  discount_amount: number;
  tax_amount: number;
  total_amount: number;
  paid_amount: number;
  balance_due: number;
  status: 'opened' | 'paid' | 'partially_paid' | 'overdue' | 'cancelled' | 'proforma';
  notes: string;
  terms: string;
  created_at: string;
  ship_via?: string;
  shipping_date?: string;
  tracking_number?: string;
  shipping_cost?: number;
}

export default function EditInvoice() {
  const { selectedCompany } = useCompany();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [taxRates, setTaxRates] = useState<TaxRate[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [productSuggestions, setProductSuggestions] = useState<any[]>([]);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState<number | null>(null);
  const [customerFilter, setCustomerFilter] = useState('');
  const [customerSuggestions, setCustomerSuggestions] = useState<any[]>([]);
  const navigate = useNavigate();
  const location = useLocation();
  const { invoice, items: initialItems } = location.state || {};
  const socketRef = useSocket();

  const calculateDiscountValue = (invoice: Invoice) => {
    if (!invoice || !invoice.discount_amount || invoice.discount_amount === 0) {
      return 0;
    }
    
    if (invoice.discount_type === 'percentage') {
      return invoice.subtotal > 0 ? Number(((invoice.discount_amount / invoice.subtotal) * 100).toFixed(2)) : 0;
    } else {
      return invoice.discount_amount;
    }
  };

  const initialFormData = {
    id: invoice?.id || 0,
    invoice_number: invoice?.invoice_number || `INV-${Date.now()}`,
    head_note: invoice?.head_note || '',
    customer_id: invoice?.customer_id?.toString() || '',
    employee_id: invoice?.employee_id?.toString() || '',
    invoice_date: invoice ? invoice.invoice_date.split('T')[0] : new Date().toISOString().split('T')[0],
    due_date: invoice?.due_date ? invoice.due_date.split('T')[0] : '',
    discount_type: invoice?.discount_type || 'fixed' as 'percentage' | 'fixed',
    discount_value: invoice ? (invoice.discount_value || calculateDiscountValue(invoice)) : 0,
    shipping_cost: invoice?.shipping_cost || 0,
    notes: invoice?.notes || '',
    terms: invoice?.terms || '',
    shipping_address: invoice?.shipping_address || '',
    billing_address: invoice?.billing_address || '',
    ship_via: invoice?.ship_via || '',
    shipping_date: invoice?.shipping_date ? invoice.shipping_date.split('T')[0] : '',
    tracking_number: invoice?.tracking_number || '',
    status: invoice?.status,
    invoice_type:
      invoice?.status === 'proforma'
        ? 'proforma'
        : invoice?.status === 'cancelled'
        ? 'cancelled'
        : invoice?.status === 'paid'
        ? 'paid'
        : 'invoice',
  };

  const [formData, setFormData] = useState(initialFormData);
  const [items, setItems] = useState<InvoiceItem[]>(initialItems || [
    {
      product_id: 0,
      product_name: '',
      description: '',
      quantity: '',
      unit_price: 0,
      actual_unit_price: 0,
      tax_rate: 0,
      tax_amount: 0,
      total_price: 0
    }
  ]);

  const fetchData = async () => {
    try {
      const [customersRes, employeesRes, productsRes, taxRatesRes] = await Promise.all([
        axiosInstance.get(`/api/getCustomers/${selectedCompany?.company_id}`),
        axiosInstance.get(`/api/employees/`),
        axiosInstance.get(`/api/getProducts/${selectedCompany?.company_id}`),
        axiosInstance.get(`/api/tax-rates/${selectedCompany?.company_id}`)
      ]);

      setCustomers(Array.isArray(customersRes.data) ? customersRes.data : []);
      setEmployees(Array.isArray(employeesRes.data) ? employeesRes.data : []);
      setProducts(Array.isArray(productsRes.data) ? productsRes.data : []);
      const taxRatesData = Array.isArray(taxRatesRes.data) && Array.isArray(taxRatesRes.data[0]) 
        ? taxRatesRes.data[0] 
        : Array.isArray(taxRatesRes.data) 
          ? taxRatesRes.data 
          : [];
      setTaxRates(taxRatesData);

      const defaultTaxRate = taxRatesData.find((tax: TaxRate) => tax.is_default === 1);
      if (defaultTaxRate) {
        setItems(prevItems => prevItems.map(item => ({
          ...item,
          tax_rate: item.tax_rate === 0 ? parseFloat(defaultTaxRate.rate) : item.tax_rate
        })));
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      setTaxRates([]);
      setError('Failed to fetch data');
    }
  };

  useEffect(() => {
    const socket = socketRef.current;
    if (!socket) return;
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    console.log('Socket in edit invoice:', socket);
    console.log('User in edit invoice:', user);
    console.log('Invoice in edit invoice:', invoice);

    socket.emit('start_edit_invoice', { invoiceId: invoice.id, user });
    console.log('Socket in edit invoice emit start_edit_invoice', { invoiceId: invoice.id, user });

    return () => {
      socket.emit('stop_edit_invoice', { invoiceId: invoice.id, user });
      console.log('Socket in edit invoice emit stop_edit_invoice', { invoiceId: invoice.id, user });
    };
  }, [invoice.id]);

  useEffect(() => {
    if (selectedCompany) {
      fetchData();
      setFormData(prev => ({
        ...prev,
        notes: invoice?.notes || selectedCompany.notes || '',
        terms: invoice?.terms || selectedCompany.terms_and_conditions || '',
        head_note: invoice?.head_note || ''
      }));
    }
  }, [selectedCompany, invoice]);

  useEffect(() => {
    if (invoice) {
      setFormData(prev => ({
        ...prev,
        discount_value: invoice.discount_value || calculateDiscountValue(invoice)
      }));
    }
  }, [invoice]);

  useEffect(() => {
    const selectedCustomer = customers.find(customer => customer.id === parseInt(formData.customer_id));
    if (selectedCustomer) {
      setFormData(prev => ({
        ...prev,
        shipping_address: selectedCustomer.shipping_address || prev.shipping_address,
        billing_address: selectedCustomer.billing_address || selectedCustomer.shipping_address || prev.billing_address
      }));
    }
  }, [formData.customer_id, customers]);

  useEffect(() => {
    if (activeSuggestionIndex !== null) {
      const activeItem = items[activeSuggestionIndex];
      if (activeItem?.product_name) {
        const filteredSuggestions = products.filter(product =>
          product.name.toLowerCase().includes(activeItem.product_name.toLowerCase())
        );
        setProductSuggestions(filteredSuggestions);
      } else {
        setProductSuggestions(products);
      }
    } else {
      setProductSuggestions([]);
    }
  }, [items, products, activeSuggestionIndex]);

  const updateItem = (index: number, field: keyof InvoiceItem, value: any) => {
    const updatedItems = [...items];
    updatedItems[index] = { ...updatedItems[index], [field]: value };

    if (field === 'product_id' && value) {
      const product = products.find(p => p.id === parseInt(value));
      if (product) {
        updatedItems[index].product_name = product.name;
        updatedItems[index].description = product.description || '';
        updatedItems[index].unit_price = product.unit_price || 0;
        updatedItems[index].product_id = product.id;
      }
    }

    if (field === 'quantity' || field === 'unit_price' || field === 'tax_rate') {
      const item = updatedItems[index];
      const subtotal = Number(item.quantity) * item.unit_price;
      item.actual_unit_price = Number((item.unit_price / (1 + item.tax_rate / 100)).toFixed(2));
      item.tax_amount = Number((item.actual_unit_price * item.tax_rate / 100 * Number(item.quantity)).toFixed(2));
      item.total_price = Number(subtotal.toFixed(2));
    }

    setItems(updatedItems);
  };

  const addItem = () => {
    const defaultTaxRate = taxRates.find(tax => tax.is_default === 1);
    setItems([...items, {
      product_id: 0,
      product_name: '',
      description: '',
      quantity: '',
      unit_price: 0,
      actual_unit_price: 0,
      tax_rate: defaultTaxRate ? parseFloat(defaultTaxRate.rate) : 0,
      tax_amount: 0,
      total_price: 0
    }]);
    setProductSuggestions(products);
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const calculateTotals = () => {
    const subtotal = Number(items.reduce((sum, item) => sum + (Number(item.quantity) * item.actual_unit_price), 0).toFixed(2));
    const totalTax = Number(items.reduce((sum, item) => sum + item.tax_amount, 0).toFixed(2));
    const shippingCost = Number(formData.shipping_cost || 0);
    
    let discountAmount = 0;
    const discountValue = Number(formData.discount_value) || 0;
    if (formData.discount_type === 'percentage') {
      discountAmount = Number(((subtotal * discountValue) / 100).toFixed(2));
    } else {
      discountAmount = Number(discountValue.toFixed(2));
    }
  
    const total = Number((subtotal + shippingCost + totalTax - discountAmount).toFixed(2));
    const balanceDue = Number((total - Number(invoice?.paid_amount || 0)).toFixed(2));
  
    return { subtotal, totalTax, discountAmount, shippingCost, total, balanceDue };
  };

  const handleSubmit = async (e: React.FormEvent) => { 
    e.preventDefault();
    setLoading(true);
    setError(null);
  
    try {
      if (!formData.invoice_number) {
        throw new Error('Invoice number is required');
      }
      if (!formData.customer_id) {
        throw new Error('Customer is required');
      }
      if (!formData.invoice_date) {
        throw new Error('Invoice date is required');
      }
      if (!formData.due_date) {
        throw new Error('Due date is required');
      }
      if (!items.some(item => item.product_id !== 0)) {
        throw new Error('At least one valid item is required');
      }
  
      const { subtotal, totalTax, discountAmount, shippingCost, total, balanceDue } = calculateTotals();
  
      const submitData = {
        invoice_number: formData.invoice_number,
        head_note: formData.head_note || null,
        company_id: selectedCompany?.company_id,
        customer_id: parseInt(formData.customer_id) || null,
        employee_id: formData.employee_id ? parseInt(formData.employee_id) : null,
        invoice_date: formData.invoice_date,
        due_date: formData.due_date,
        subtotal: Number(subtotal),
        tax_amount: Number(totalTax),
        discount_type: formData.discount_type,
        discount_amount: Number(discountAmount),
        discount_value: Number(formData.discount_value),
        shipping_cost: Number(shippingCost),
        total_amount: Number(total),
        paid_amount: invoice?.paid_amount || 0,
        balance_due:
          formData.invoice_type === "proforma" && formData.status === "proforma"
        ? 0
        : Number(balanceDue),
        status: formData.status,
        notes: formData.notes || null,
        terms: formData.terms || null,
        shipping_address: formData.shipping_address || null,
        billing_address: formData.billing_address || null,
        ship_via: formData.ship_via || null,
        shipping_date: formData.shipping_date || null,
        tracking_number: formData.tracking_number || null,
        items: items.map(item => ({
          product_id: parseInt(item.product_id as any) || null,
          product_name: item.product_name || null,
          description: item.description,
          quantity: Number(item.quantity),
          unit_price: Number(item.unit_price),
          actual_unit_price: Number(item.actual_unit_price),
          tax_rate: Number(item.tax_rate),
          tax_amount: Number(item.tax_amount),
          total_price: Number(item.total_price)
        })),
        invoice_type: formData.invoice_type || null
      };
  
      console.log('Submitting invoice update:', submitData);

      const userRole = JSON.parse(localStorage.getItem('user') || '{}')?.role;
      console.log('User role:', userRole);

      try {
          if (userRole !== 'admin' && submitData.status === 'opened' && initialFormData.invoice_type === 'proforma') {
            const eligibilityRes = await axiosInstance.post(`/api/checkCustomerEligibility`, {
              company_id: selectedCompany?.company_id, 
              customer_id: parseInt(formData.customer_id),
              invoice_total: total,
              operation_type: 'create'
            });

            console.log('Eligibility response:', eligibilityRes.data);

            if (!eligibilityRes.data.eligible) {
              throw new Error(eligibilityRes.data.reason || 'Customer is not eligible to create more invoices');
            }

            console.log('Customer is eligible to update invoice');
          }

          console.log('Submitting invoice data:', submitData);

          await axiosInstance.put(`/api/updateInvoice/${selectedCompany?.company_id}/${invoice.id}`, submitData);

          console.log('Invoice updated:');

      } catch (error: any) {
        console.error('Invoice update failed:', error);
        throw new Error(error.response?.data?.reason || error.message || 'Failed to update invoice');
      }

      setFormData(initialFormData);
      setItems([
        {
          product_id: 0,
          product_name: '',
          description: '',
          quantity: 0,
          unit_price: 0,
          actual_unit_price: 0,
          tax_rate: 0,
          tax_amount: 0,
          total_price: 0
        }
      ]);
  
      navigate('/dashboard/invoices', { replace: true });
      alert('Invoice updated successfully');
    } catch (error: any) {
      console.error('Error updating invoice:', error);
      const errorMessage = error.response?.data?.error || error.message || 'Failed to update invoice';
      setError(errorMessage);
      alert(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const { subtotal, totalTax, discountAmount, shippingCost, total, balanceDue } = calculateTotals();

  return (
    <motion.div
      initial={{ opacity: 0, y: 100 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 50 }}
      transition={{ duration: 0.5 }}
    >
      <div className="container mx-auto px-4 py-8">
        <div className="relative mt-20 mb-20 mx-auto p-5 border w-full max-w-7xl shadow-lg rounded-md bg-white">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-medium text-gray-900">
              Edit Invoice #{invoice?.invoice_number}
            </h3>
            <button onClick={() => navigate("/dashboard/sales", { state: { activeTab: 'invoices' } })}>
              <X className="h-6 w-6" />
            </button>
          </div>

          {error && (
            <div className="mb-4 p-4 bg-red-100 text-red-700 rounded">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Invoice Number *
                </label>
                <input
                  type="text"
                  className="input"
                  disabled
                  value={formData.invoice_number}
                  onChange={(e) => setFormData({ ...formData, invoice_number: e.target.value })}
                  placeholder="Enter invoice number"
                  readOnly
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Customer *
                </label>
                <div className="relative">
                  <input
                    type="text"
                    className="input w-full"
                    value={customerFilter || customers.find(customer => customer.id === parseInt(formData.customer_id))?.name || ''}
                    onChange={(e) => {
                      const value = e.target.value;
                      setCustomerFilter(value);
                      setFormData({ ...formData, customer_id: '' });
                      const filtered = customers.filter(customer =>
                        customer.name.toLowerCase().includes(value.toLowerCase())
                      );
                      setCustomerSuggestions(filtered.length > 0 ? filtered : customers);
                    }}
                    onFocus={() => {
                      setCustomerSuggestions(customers);
                      setCustomerFilter('');
                    }}
                    placeholder="Search customers..."
                    onBlur={() => setTimeout(() => {
                      setCustomerSuggestions([]);
                      setCustomerFilter('');
                    }, 100)}
                    required
                  />
                  {customerSuggestions.length > 0 && (
                    <ul className="absolute z-10 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-y-auto w-full mt-1">
                      {customerSuggestions.map((customer) => (
                        <li
                          key={customer.id}
                          className="px-4 py-2 hover:bg-gray-100 cursor-pointer"
                          onMouseDown={() => {
                            setFormData({
                              ...formData,
                              customer_id: customer.id.toString(),
                              shipping_address: customer.shipping_address || '',
                              billing_address: customer.billing_address || customer.shipping_address || ''
                            });
                            setCustomerFilter(customer.name);
                            setCustomerSuggestions([]);
                          }}
                        >
                          {customer.name}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Customer Shipping Address
                </label>
                <input
                  type="text"
                  className="input"
                  value={formData.shipping_address || ''}
                  onChange={(e) => setFormData({ ...formData, shipping_address: e.target.value })}
                  placeholder="Shipping Address"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Billing Address
                </label>
                <input
                  type="text"
                  className="input"
                  value={formData.billing_address || ''}
                  onChange={(e) => setFormData({ ...formData, billing_address: e.target.value })}
                  placeholder="Billing Address"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Employee
                </label>
                <select
                  className="input"
                  value={formData.employee_id}
                  onChange={(e) => setFormData({ ...formData, employee_id: e.target.value })}
                >
                  <option value="">Select Employee</option>
                  {employees.map((employee) => (
                    <option key={employee.id} value={employee.id}>
                      {employee.name || `${employee.first_name} ${employee.last_name}`}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Invoice Date *
                </label>
                <input
                  type="date"
                  required
                  disabled
                  className="input"
                  value={formData.invoice_date}
                  onChange={(e) => setFormData({ ...formData, invoice_date: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Due Date *
                </label>
                <input
                  type="date"
                  required
                  className="input"
                  value={formData.due_date}
                  onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                  disabled
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Ship Via
                </label>
                <input
                  type="text"
                  className="input"
                  value={formData.ship_via || ''}
                  onChange={(e) => setFormData({ ...formData, ship_via: e.target.value })}
                  placeholder="Shipping Method"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Shipping Date
                </label>
                <input
                  type="date"
                  className="input"
                  value={formData.shipping_date || ''}
                  onChange={(e) => setFormData({ ...formData, shipping_date: e.target.value })}
                  placeholder="Shipping Date"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tracking Number
                </label>
                <input
                  type="text"
                  className="input"
                  value={formData.tracking_number || ''}
                  onChange={(e) => setFormData({ ...formData, tracking_number: e.target.value })}
                  placeholder="Tracking Number"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Status
                </label>
                <select
                  className="input"
                  value={formData.status || ''}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  disabled={formData.invoice_type === 'cancelled' || formData.invoice_type === 'paid' || formData.invoice_type === 'partially_paid'}
                >
                  <option value="">Select Status</option>
                  {formData.invoice_type === 'proforma' ? (
                    <>
                      <option value="opened">Opened</option>
                      <option value="cancelled">Cancelled</option>
                    </>
                  ) : (
                    <option value="cancelled">Cancelled</option>
                  )}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Head Note
              </label>
              <input
                type="text"
                className="input"
                value={formData.head_note || ''}
                onChange={(e) => setFormData({ ...formData, head_note: e.target.value })}
                placeholder="Enter head note"
              />
            </div>

            <div>
              <div className="flex justify-between items-center mb-4">
                <h4 className="text-lg font-medium text-gray-900">Items</h4>
                <button
                  type="button"
                  onClick={addItem}
                  className="btn btn-secondary btn-sm"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Item
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full border border-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Qty</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Unit Price</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Actual Unit Price</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Tax %</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Total</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item, index) => (
                      <tr key={index} className="border-t" style={{ paddingBottom: '2rem' }}>
                        <td className="px-4 py-2">
                          <input
                            type="text"
                            value={item.product_name || ''}
                            onChange={(e) => {
                              updateItem(index, 'product_name', e.target.value);
                              setActiveSuggestionIndex(index);
                            }}
                            onFocus={() => {
                              setActiveSuggestionIndex(index);
                              const filtered = products.filter(product =>
                                product.name.toLowerCase().includes(item.product_name?.toLowerCase() || '')
                              );
                              setProductSuggestions(filtered.length > 0 ? filtered : products);
                            }}
                            onBlur={() => {
                              setTimeout(() => {
                                if (activeSuggestionIndex === index) {
                                  setProductSuggestions([]);
                                  setActiveSuggestionIndex(null);
                                }
                              }, 200);
                            }}
                            placeholder="Search product"
                            className="border rounded px-2 py-1 w-full"
                          />
                          {activeSuggestionIndex === index && productSuggestions.length > 0 && (
                            <ul className="absolute z-10 w-full bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-y-auto mt-1">
                              {productSuggestions.map(product => (
                                <li
                                  key={product.id}
                                  className="px-4 py-2 hover:bg-gray-100 cursor-pointer flex items-center"
                                  onMouseDown={() => {
                                    const updatedItems = [...items];
                                    updatedItems[index] = {
                                      ...updatedItems[index],
                                      product_id: product.id,
                                      product_name: product.name,
                                      description: product.description || '',
                                      unit_price: product.unit_price || 0,
                                    };
                                    const defaultTaxRate = taxRates.find(tax => tax.is_default === 1);
                                    const taxRate = updatedItems[index].tax_rate || (defaultTaxRate ? parseFloat(defaultTaxRate.rate) : 0);
                                    updatedItems[index].tax_rate = taxRate;
                                    const subtotal = Number(updatedItems[index].quantity) * updatedItems[index].unit_price;
                                    updatedItems[index].tax_amount = Number((item.actual_unit_price * taxRate / 100).toFixed(2));
                                    updatedItems[index].actual_unit_price = Number(((updatedItems[index].unit_price * 100) / (100 + taxRate)).toFixed(2));
                                    updatedItems[index].total_price = Number(subtotal.toFixed(2));
                                    setItems(updatedItems);
                                    setProductSuggestions([]);
                                    setActiveSuggestionIndex(null);
                                  }}
                                >
                                  {product.image && (
                                    <img
                                      src={`http://localhost:3000${product.image}`}
                                      alt={product.name}
                                      className="w-8 h-8 object-cover mr-2 rounded"
                                    />
                                  )}
                                  <span>{product.name}</span>
                                </li>
                              ))}
                            </ul>
                          )}
                        </td>
                        <td className="px-4 py-2">
                          <input
                            type="text"
                            className="input"
                            value={item.description}
                            onChange={(e) => updateItem(index, 'description', e.target.value)}
                            placeholder="Item description"
                            required
                          />
                        </td>
                        <td className="px-4 py-2">
                          <input
                            type="number"
                            step="0"
                            min="0"
                            className="input w-20"
                            value={item.quantity}
                            onChange={(e) => updateItem(index, 'quantity', parseFloat(e.target.value) || '')}
                            placeholder='QTY'
                            required
                          />
                        </td>
                        <td className="px-4 py-2">
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            className="input w-24"
                            value={item.unit_price}
                            onChange={(e) => updateItem(index, 'unit_price', parseFloat(e.target.value) || 0)}
                            required
                          />
                        </td>
                        <td className="px-4 py-2 text-center">
                          Rs. {Number(item.actual_unit_price ?? 0).toFixed(2)}
                        </td>
                        <td className="px-4 py-2">
                          <select
                            className="input w-20"
                            value={item.tax_rate}
                            onChange={(e) => updateItem(index, 'tax_rate', parseFloat(e.target.value) || 0)}
                          >
                            {taxRates.length > 0 ? (
                              <>
                                {taxRates.map((tax) => (
                                  <option key={tax.tax_rate_id} value={parseFloat(tax.rate)}>
                                    {tax.name} ({tax.rate}%)
                                  </option>
                                ))}
                                <option value={0}>0% No Tax</option>
                              </>
                            ) : (
                              <option value={0} disabled>No tax rates available</option>
                            )}
                          </select>
                        </td>
                        <td className="px-4 py-2 text-center border border-gray-200">
                          Rs. {Number(item.total_price).toFixed(2)}
                        </td>
                        <td className="px-4 py-2">
                          <button
                            type="button"
                            onClick={() => removeItem(index)}
                            className="text-red-600 hover:text-red-900"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Message On Invoice
                  </label>
                  <textarea
                    className="input min-h-[80px]"
                    style={{ resize: 'none' }}
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="Additional notes..."
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Message On Statement
                  </label>
                  <textarea
                    className="input min-h-[80px]"
                    style={{ resize: 'none' }}
                    value={formData.terms}
                    onChange={(e) => setFormData({ ...formData, terms: e.target.value })}
                    placeholder="Terms and conditions..."
                  />
                </div>
                <div>
                  <label className='block text-sm font-medium text-gray-700 mb-1'>
                    Attachment
                  </label>
                  <input
                    type="file"
                    className="input"
                    accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                    // onChange={(e) => {
                    //   if (e.target.files && e.target.files.length > 0) {
                    //     const file = e.target.files[0];
                    //     setFormData({ ...formData, attachment: file });
                    //   }
                    // }}
                  />
                </div>
              </div>

              <div className="space-y-4">
                <div className="bg-gray-50 p-4 rounded-lg">
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span>Subtotal:</span>
                      <span>Rs. {subtotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span>Discount:</span>
                      <div className="flex items-center space-x-2">
                        <select
                          className="input w-24"
                          value={formData.discount_type}
                          onChange={(e) => setFormData({ ...formData, discount_type: e.target.value as 'percentage' | 'fixed' })}
                        >
                          <option value="fixed">Rs. </option>
                          <option value="percentage">%</option>
                        </select>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          className="input w-24"
                          value={formData.discount_value}
                          onChange={(e) => setFormData({ ...formData, discount_value: parseFloat(e.target.value) || 0 })}
                        />
                        <span className="w-20 text-right">Rs. {discountAmount.toFixed(2)}</span>
                      </div>
                    </div>
                    <div className="flex justify-between items-center">
                      <span>Shipping Cost:</span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        className="input w-24 text-right"
                        value={formData.shipping_cost}
                        onChange={(e) => setFormData({ ...formData, shipping_cost: parseFloat(e.target.value) || 0 })}
                      />
                    </div>
                    <div className="flex justify-between">
                      <span>Tax:</span>
                      <span>Rs. {totalTax.toFixed(2)}</span>
                    </div>
                    
                    <div className="flex justify-between font-bold text-lg border-t pt-2">
                      <span>Total:</span>
                      <span>Rs. {total.toFixed(2)}</span>
                    </div>
                    <hr />
                    <div className="flex justify-between text-green-500">
                      <span>Paid Amount:</span>
                      <span>Rs. {Number(invoice?.paid_amount || 0).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-red-500">
                      <span>Balance Due:</span>
                      <span>Rs. {balanceDue.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end space-x-3 pt-4">
              <button
                type="button"
                onClick={() => navigate("/dashboard/sales", { state: { activeTab: 'invoices' } })}
                className="btn btn-secondary btn-md"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="btn btn-primary btn-md"
              >
                {loading ? 'Updating...' : 'Update Invoice'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </motion.div>
  );
}