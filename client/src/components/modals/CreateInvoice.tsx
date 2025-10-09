import React, { useState, useEffect } from 'react';
import { useCompany } from '../../contexts/CompanyContext';
import axiosInstance from '../../axiosInstance';
import { X, Plus, Trash2, FileCheck } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';

interface InvoiceModalProps {
  invoice?: any;
  onSave?: () => void;
}

interface InvoiceItem {
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
  terms: string;
  shipping_address?: string;
  billing_address?: string;
  credit_limit: number;
  current_balance: number;
}

interface TaxRate {
  tax_rate_id: number;
  company_id: number;
  name: string;
  rate: string;
  is_default: number;
  created_at: string;
}

export default function InvoiceModal({ invoice, onSave }: InvoiceModalProps) {
  const { selectedCompany } = useCompany();
  const location = useLocation();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [company, setCompany] = useState<any>();
  const [employees, setEmployees] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [taxRates, setTaxRates] = useState<TaxRate[]>([]);
  const [customerEstimates, setCustomerEstimates] = useState<any[]>([]);
  const [customerFilter, setCustomerFilter] = useState('');
  const [customerSuggestions, setCustomerSuggestions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [productSuggestions, setProductSuggestions] = useState<any[]>([]);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState<number | null>(null);
  const [showEstimateSelection, setShowEstimateSelection] = useState(false);
  const [showEstimateSidebar, setShowEstimateSidebar] = useState(false);
  const navigate = useNavigate();
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [showInvoiceTypeDropdown, setShowInvoiceTypeDropdown] = useState(false);

  const initialFormData = {
    invoice_number: `INV-${Date.now()}`,
    head_note: '',
    customer_id: '',
    employee_id: '',
    estimate_id: '',
    invoice_date: new Date().toISOString().split('T')[0],
    due_date: '',
    discount_type: 'fixed' as 'percentage' | 'fixed',
    discount_value: 0,
    shipping_cost: 0,
    shipping_tax_rate: 0,
    notes: '',
    terms: '',
    shipping_address: '',
    billing_address: '',
    ship_via: '',
    shipping_date: '',
    tracking_number: '',
    invoice_type: 'invoice' as 'invoice' | 'proforma',
  };

  const [newCustomerForm, setNewCustomerForm] = useState({
    name: '',
    email: '',
    is_taxable: false,
    tax_number: '',
    phone: '',
    vehicle_number: '',
    credit_limit: 0,
    current_balance: 0,
    billing_address: '',
    billing_city: '',
    billing_province: '',
    billing_postal_code: '',
    billing_country: '',
    shipping_same_as_billing: true,
    shipping_address: '',
    shipping_city: '',
    shipping_province: '',
    shipping_postal_code: '',
    shipping_country: '',
    primary_payment_method: '',
    terms: '',
    delivery_option: '',
    invoice_language: '',
    sales_tax_registration: '',
    opening_balance: 0,
    as_of_date: ''
  });

  const initialItems: InvoiceItem[] = [{
    product_id: 0,
    product_name: '',
    description: '',
    quantity: '',
    unit_price: 0,
    actual_unit_price: 0,
    tax_rate: 0,
    tax_amount: 0,
    total_price: 0
  }];

  const [formData, setFormData] = useState(invoice ? {
    ...initialFormData,
    ...invoice,
    invoice_date: invoice.invoice_date.split('T')[0],
    shipping_cost: invoice.shipping_cost || 0,
    invoice_type: invoice.status === 'proforma' ? 'proforma' : 'invoice',
  } : initialFormData);

  const [items, setItems] = useState<InvoiceItem[]>(invoice?.items || initialItems);

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

  const fetchCustomerEstimates = async (customerId: string) => {
    if (!customerId) return;
    try {
      const response = await axiosInstance.get(`/api/getEstimatesByCustomer/${selectedCompany?.company_id}/${customerId}`);
      const pendingEstimates = Array.isArray(response.data)
        ? response.data.filter((estimate: any) => estimate.status === 'pending')
        : [];
      setCustomerEstimates(pendingEstimates);
      if (pendingEstimates.length > 0) {
        setShowEstimateSelection(true);
      }
    } catch (error) {
      console.error('Error fetching customer estimates:', error);
      setError('Failed to fetch customer estimates');
    }
  };

  useEffect(() => {
    if (selectedCompany) {
      setCompany(selectedCompany);
      setFormData(prev => ({
        ...prev,
        notes: invoice?.notes || selectedCompany.notes || '',
        terms: invoice?.terms || selectedCompany.terms_and_conditions || ''
      }));
      fetchData();
    }
  }, [selectedCompany, invoice]);

  useEffect(() => {
    if (selectedCompany && location.state?.estimateId) {
      loadEstimateData(location.state.estimateId.toString());
    }
  }, [selectedCompany, location.state]);

  const loadEstimateData = async (estimateId: string) => {
    if (!estimateId) return;
    try {
      const [estimateRes, itemsRes] = await Promise.all([
        axiosInstance.get(`/api/getEstimates/${selectedCompany?.company_id}`),
        axiosInstance.get(`/api/estimatesItems/${selectedCompany?.company_id}/${estimateId}`)
      ]);

      const estimate = estimateRes.data.find((e: any) => e.id === parseInt(estimateId));
      if (!estimate) {
        throw new Error('Selected estimate not found');
      }

      setFormData({
        ...formData,
        invoice_number: `INV-${estimate.estimate_number}-${Date.now()}`,
        estimate_id: estimateId,
        customer_id: estimate.customer_id.toString(),
        employee_id: estimate.employee_id ? estimate.employee_id.toString() : '',
        invoice_date: new Date().toISOString().split('T')[0],
        due_date: new Date().toISOString().split('T')[0],
        discount_type: estimate.discount_type || 'fixed',
        discount_value: Number(estimate.discount_amount) || 0,
        shipping_cost: Number(estimate.shipping_cost) || 0,
        notes: estimate.notes || '',
        terms: estimate.terms || '',
        shipping_address: estimate.shipping_address || '',
        billing_address: estimate.billing_address || '',
        ship_via: estimate.ship_via || '',
        shipping_date: estimate.shipping_date ? estimate.shipping_date.split('T')[0] : '',
        tracking_number: estimate.tracking_number || ''
      });

      setItems(itemsRes.data.map((item: any) => ({
        product_id: item.product_id || 0,
        product_name: item.product_name || '',
        description: item.description || '',
        quantity: Number(item.quantity) || 1,
        unit_price: Number(item.unit_price) || 0,
        actual_unit_price: Number(item.actual_unit_price) || Number(item.unit_price) || 0,
        tax_rate: Number(item.tax_rate) || 0,
        tax_amount: Number(item.tax_amount) || 0,
        total_price: Number(item.total_price) || 0
      })));

      // setShowEstimateSelection(false);
      // setShowEstimateSidebar(false);
    } catch (error) {
      console.error('Error loading estimate data:', error);
      setError('Failed to load estimate data');
    }
  };

  useEffect(() => {
    const selectedCustomer = customers.find(customer => customer.id === parseInt(formData.customer_id));
    if (selectedCustomer) {
      setFormData(prev => ({
        ...prev,
        shipping_address: selectedCustomer.shipping_address || '',
        billing_address: selectedCustomer.billing_address || selectedCustomer.shipping_address || '',
        due_date:
          selectedCustomer.terms === 'net15'
            ? new Date(new Date(initialFormData.invoice_date).getTime() + 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
            : selectedCustomer.terms === 'net30'
            ? new Date(new Date(initialFormData.invoice_date).getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
            : selectedCustomer.terms === 'net60'
            ? new Date(new Date(initialFormData.invoice_date).getTime() + 60 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
            : initialFormData.invoice_date,
      }));
      if (!invoice && formData.customer_id) {
        fetchCustomerEstimates(formData.customer_id);
        setShowEstimateSidebar(true);
      } else {
        setShowEstimateSidebar(false);
      }
    } else {
      setShowEstimateSidebar(false);
    }
  }, [formData.customer_id, customers, invoice]);

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
      const shippingCost = Number(formData.shipping_cost);
      const subtotal = Number(item.quantity || 0) * item.unit_price;
      item.actual_unit_price = Number((item.unit_price / (1 + item.tax_rate / 100)).toFixed(2));
      item.tax_amount = Number((item.actual_unit_price + shippingCost) * item.tax_rate / 100);
      item.total_price = Number((subtotal).toFixed(2));
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
    const shippingCost = Number(formData.shipping_cost || 0);
    const shippingTaxRate = Number(formData.shipping_tax_rate || 0);
    const shippingTaxAmount = Number((shippingCost * shippingTaxRate / 100).toFixed(2));
    const totalShippingWithTax = Number((shippingCost + shippingTaxAmount).toFixed(2));
    
    const subtotal = Number(items.reduce((sum, item) => sum + ((Number(item.quantity) || 0) * item.actual_unit_price), 0).toFixed(2));
    const totalTax = Number(items.reduce((sum, item) => sum + ((Number(item.quantity) || 0) * item.tax_amount), 0).toFixed(2));
    
    let discountAmount = 0;
    if (formData.discount_type === 'percentage') {
      discountAmount = Number(((subtotal * Number(formData.discount_value)) / 100).toFixed(2));
    } else {
      discountAmount = Number(formData.discount_value.toFixed(2));
    }
  
    const total = Number((subtotal + totalShippingWithTax + totalTax - discountAmount).toFixed(2));
  
    return { subtotal, totalTax, discountAmount, shippingCost: totalShippingWithTax, shippingTaxAmount, total };
  };

  const handleSubmit = async (e: React.FormEvent, invoiceType?: 'invoice' | 'proforma') => {
    e.preventDefault();
    setLoading(true);
    setError(null);
  
    try {
      // Use the invoiceType parameter if provided, otherwise use the formData value
      const currentInvoiceType = invoiceType || formData.invoice_type;
  
      if (!formData.invoice_number) {
        throw new Error('Invoice number is required');
      }
      if (!formData.customer_id) {
        throw new Error('Customer is required');
      }
      if (!formData.invoice_date) {
        throw new Error('Invoice date is required');
      }
      if (!items.some(item => item.product_id !== 0)) {
        throw new Error('At least one valid item is required');
      }
  
      const { subtotal, totalTax, discountAmount, shippingCost, shippingTaxAmount, total } = calculateTotals();
  
      // const selectedCustomer = customers.find(customer => customer.id === parseInt(formData.customer_id));
      // if (selectedCustomer && selectedCustomer.credit_limit < total) {
      //   throw new Error("Invoice total exceeds customer's credit limit");
      // }
  
      const submitData = {
        ...formData,
        company_id: selectedCompany?.company_id,
        customer_id: parseInt(formData.customer_id) || null,
        employee_id: formData.employee_id ? parseInt(formData.employee_id) : null,
        estimate_id: formData.estimate_id ? parseInt(formData.estimate_id) : null,
        head_note: formData.head_note || '',
        subtotal: Number(subtotal),
        tax_amount: Number(totalTax),
        discount_amount: Number(discountAmount),
        shipping_cost: Number(shippingCost),
        shipping_tax_rate: Number(formData.shipping_tax_rate),
        total_amount: Number(total),
        status: currentInvoiceType === 'proforma' ? 'proforma' : 'opened',
        items: items.map(item => ({
          ...item,
          product_id: parseInt(item.product_id as any) || null,
          quantity: Number(item.quantity),
          unit_price: Number(item.unit_price),
          actual_unit_price: Number(item.actual_unit_price),
          tax_rate: Number(item.tax_rate),
          tax_amount: Number(item.tax_amount),
          total_price: Number(item.total_price)
        }))
      };
  
      let response;

      if (invoice) {
        response = await axiosInstance.put(`/api/invoices/${selectedCompany?.company_id}/${invoice.id}`, submitData);
      } else {
        const userRole = JSON.parse(localStorage.getItem('user') || '{}')?.role;
        console.log('User role:', userRole);

        try {
          // If not admin and not proforma, run eligibility check
          if (userRole !== 'admin' && submitData.status !== 'proforma') {
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

            console.log('Customer is eligible to create invoice');
          }

          console.log('Submitting invoice data:', submitData);

          const response = await axiosInstance.post(
            `/api/createInvoice/${selectedCompany?.company_id}`,
            submitData
          );

          console.log('Create invoice response:', response.data);

          if (formData.estimate_id) {
            await axiosInstance.post(`/api/updateEstimateAfterInvoice/${selectedCompany?.company_id}/${formData.estimate_id}`, {
              invoice_id: response.data.id,
            });
          }

          console.log('Invoice created:', response.data);

          setFormData(initialFormData);
          setItems(initialItems);
      
          navigate("/dashboard/sales", { state: { activeTab: 'invoices' } });

        } catch (error: any) {
          console.error('Error saving invoice:', error);
          const errorMessage = error.response?.data?.reason || error.response?.data?.error || error.message || 'Failed to save invoice';
          setError(errorMessage);
          alert(errorMessage);
          setFormData(initialFormData);
          setItems(initialItems);
      
          navigate("/dashboard/sales", { state: { activeTab: 'invoices' } });
        }
      }
  
    } catch (error: any) {
      console.error('Error saving invoice:', error);
      const errorMessage = error.response?.data?.reason || error.response?.data?.error || error.message || 'Failed to save invoice';
      setError(errorMessage);
      alert(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const { subtotal, totalTax, discountAmount, shippingCost, shippingTaxAmount, total } = calculateTotals();

  const handleNewCustomerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const submitData = {
        ...newCustomerForm,
        company_id: selectedCompany?.company_id,
        shipping_address: newCustomerForm.shipping_same_as_billing ? newCustomerForm.billing_address : newCustomerForm.shipping_address,
        shipping_city: newCustomerForm.shipping_same_as_billing ? newCustomerForm.billing_city : newCustomerForm.shipping_city,
        shipping_province: newCustomerForm.shipping_same_as_billing ? newCustomerForm.billing_province : newCustomerForm.shipping_province,
        shipping_postal_code: newCustomerForm.shipping_same_as_billing ? newCustomerForm.billing_postal_code : newCustomerForm.shipping_postal_code,
        shipping_country: newCustomerForm.shipping_same_as_billing ? newCustomerForm.billing_country : newCustomerForm.shipping_country,
        opening_balance: parseFloat(newCustomerForm.opening_balance.toString()) || 0,
        credit_limit: parseFloat(newCustomerForm.credit_limit.toString()) || 0,
        current_balance: parseFloat(newCustomerForm.current_balance.toString()) || 0,
      };
  
      console.log('Submitting customer data:', submitData);
      const response = await axiosInstance.post(`/api/createCustomers/${selectedCompany?.company_id}`, submitData);
      console.log('API response:', response.data);
  
      const newCustomer = response.data.customer;
      if (!newCustomer || !newCustomer.id) {
        throw new Error('Invalid customer data returned from server');
      }
  
      setCustomers((prev) => [...prev, newCustomer]);
      setFormData({
        ...formData,
        customer_id: newCustomer.id.toString(),
        shipping_address: newCustomer.shipping_address || '',
        billing_address: newCustomer.billing_address || newCustomer.shipping_address || '',
      });
      setCustomerFilter(newCustomer.name);
      setShowCustomerModal(false);
      setNewCustomerForm({
        name: '',
        email: '',
        is_taxable: false,
        tax_number: '',
        phone: '',
        vehicle_number: '',
        credit_limit: 0,
        current_balance: 0,
        billing_address: '',
        billing_city: '',
        billing_province: '',
        billing_postal_code: '',
        billing_country: '',
        shipping_same_as_billing: true,
        shipping_address: '',
        shipping_city: '',
        shipping_province: '',
        shipping_postal_code: '',
        shipping_country: '',
        primary_payment_method: '',
        terms: '',
        delivery_option: '',
        invoice_language: '',
        sales_tax_registration: '',
        opening_balance: 0,
        as_of_date: '',
      });
    } catch (error: any) {
      console.error('Error creating customer:', error);
      const errorMessage = error.response?.data?.message || error.message || 'Failed to create customer';
      setError(errorMessage);
      if (errorMessage.includes('Email already in use')) {
        alert('Customer with this email already exists.');
      } else {
        alert(errorMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  const renderAddress = (address: {
    address: string;
    city: string;
    province: string;
    postal_code: string;
    country: string;
  }) => {
    return Object.values(address)
      .filter(Boolean)
      .join(', ');
  };

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
              {invoice ? 'Edit Invoice' : 'Create New Invoice'}
            </h3>
            <button 
              onClick={() => navigate("/dashboard/sales", { state: { activeTab: 'invoices' } })} 
              className="text-gray-400 hover:text-gray-600">
              <X className="h-6 w-6" />
            </button>
          </div>

          {error && (
            <div className="mb-4 p-4 bg-red-100 text-red-700 rounded">
              {error}
            </div>
          )}

          {showEstimateSidebar && customerEstimates.length > 0 && (
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="fixed top-0 right-0 h-full w-96 bg-white shadow-2xl z-50 overflow-y-auto"
            >
              <div className="p-6">
                <div className="flex justify-between items-center mb-4">
                  <h4 className="text-lg font-medium text-blue-900">Add to Invoice</h4>
                  <button
                    onClick={() => setShowEstimateSidebar(false)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <X className="h-6 w-6" />
                  </button>
                </div>
                <div className="space-y-4">
                  {customerEstimates.map((estimate) => {
                    const isSelected = formData.estimate_id?.toString() === estimate.id.toString();
                    return (
                      <div
                        key={estimate.id}
                        className={`p-4 border border-gray-200 rounded-lg ${isSelected ? 'bg-blue-50' : 'bg-gray-50'}`}
                      >
                        <div className="flex justify-between items-center">
                          <div>
                            <span className="font-medium">{estimate.estimate_number}</span> <br />
                            <span className="text-gray-500">Customer Name: {estimate.customer_name}</span> <br />
                            <span className="text-gray-500">Estimate Date: {new Date(estimate.estimate_date).toLocaleDateString()}</span> <br />
                            <span className="text-gray-500">Total: Rs. {estimate.total_amount}</span> <br />
                            <span className="text-gray-500">Status: ({estimate.status})</span>
                          </div>
                          {!isSelected && (
                            <button
                              onClick={() => {
                                loadEstimateData(estimate.id.toString());
                                setShowEstimateSidebar(true);
                              }}
                              className="btn btn-primary btn-sm"
                            >
                              Add
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <button
                  onClick={() => setShowEstimateSidebar(false)}
                  className="mt-4 btn btn-secondary btn-sm w-full"
                >
                  Close
                </button>
              </div>
            </motion.div>
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
                  value={formData.invoice_number}
                  onChange={(e) => setFormData({ ...formData, invoice_number: e.target.value })}
                  placeholder="Enter invoice number"
                  required
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
                      <li
                        className="px-4 py-2 hover:bg-gray-100 cursor-pointer"
                        onMouseDown={() => {
                          setShowCustomerModal(true);
                          setCustomerSuggestions([]);
                        }}
                      >
                        + New Customer
                      </li>
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
                  required
                >
                  <option value="">Select Employee</option>
                  {employees.map((employee) => (
                    <option key={employee.id} value={employee.id}>
                      {employee.name}
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
                  className="input"
                  value={formData.invoice_date}
                  onChange={(e) => setFormData({ ...formData, invoice_date: e.target.value })}
                />
              </div>

              {/* <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Due Date
                </label>
                <input
                  type="date"
                  className="input"
                  value={formData.due_date}
                  onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                />
              </div> */}

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
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Head Note
              </label>
              <input
                type="text"
                className="input w-1/2"
                value={formData.head_note || ''}
                onChange={(e) => setFormData({ ...formData, head_note: e.target.value })}
                placeholder="Head Note"
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
                                    const subtotal = (Number(updatedItems[index].quantity) || 0) * updatedItems[index].unit_price;
                                    updatedItems[index].tax_amount = Number((item.actual_unit_price * taxRate / 100).toFixed(2));
                                    updatedItems[index].actual_unit_price = Number(((updatedItems[index].unit_price * 100) / (100 + updatedItems[index].tax_rate)).toFixed(2));
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
                            min="0"
                            className="input w-20"
                            value={item.quantity}
                            onChange={(e) => updateItem(index, 'quantity', parseFloat(e.target.value) || '')}
                            placeholder="Qty"
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
                          Rs. {(item.actual_unit_price ?? 0).toFixed(2)}
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
                          Rs. {item.total_price.toFixed(2)}
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
                    onChange={(e) => {
                      if (e.target.files && e.target.files.length > 0) {
                        const file = e.target.files[0];
                        setFormData({ ...formData, attachment: file });
                      }
                    }}
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
                      <div className="flex items-center space-x-2">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          className="input w-24 text-right"
                          value={formData.shipping_cost}
                          onChange={(e) => setFormData({ ...formData, shipping_cost: parseFloat(e.target.value) || 0 })}
                        />
                        <select
                          className="input w-20"
                          value={formData.shipping_tax_rate}
                          onChange={(e) => setFormData({ ...formData, shipping_tax_rate: parseFloat(e.target.value) || 0 })}
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
                      </div>
                    </div>
                    {formData.shipping_cost > 0 && (
                      <div className="flex justify-between text-sm text-gray-600">
                        <span className="ml-4">Shipping Tax ({formData.shipping_tax_rate}%):</span>
                        <span>Rs. {shippingTaxAmount.toFixed(2)}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span>Tax:</span>
                      <span>Rs. {totalTax.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between font-bold text-lg border-t pt-2">
                      <span>Total:</span>
                      <span>Rs. {total.toFixed(2)}</span>
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
              <div className="relative">
                <div className="flex items-center">
                  <button
                    type="button"
                    disabled={loading}
                    className="btn btn-primary btn-md rounded-r-none"
                    onClick={(e) => {
                      handleSubmit(e, 'invoice');
                    }}
                  >
                    {loading ? 'Saving...' : invoice ? 'Update Invoice' : 'Create Invoice'}
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary btn-md px-3 rounded-l-none border-l border-blue-600"
                    onClick={() => setShowInvoiceTypeDropdown(!showInvoiceTypeDropdown)}
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path>
                    </svg>
                  </button>
                </div>
                {showInvoiceTypeDropdown && (
                    <div className="absolute left-10 mt-1 bg-white rounded-md shadow-lg z-10 w-auto min-w-max">
                    <button
                      type="button"
                      className="btn btn-primary btn-md px-3 rounded"
                      onClick={(e) => {
                      e.preventDefault();
                      setShowInvoiceTypeDropdown(false);
                      handleSubmit(e, 'proforma');
                      }}
                    >
                      Create Proforma Invoice
                    </button>
                    </div>
                )}
              </div>
            </div>
          </form>
          {showCustomerModal && (
            <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
              <div className="relative top-20 mx-auto p-5 border w-full max-w-2xl shadow-lg rounded-md bg-white">
                <div className="mt-3">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Add New Customer</h3>
                  <form onSubmit={handleNewCustomerSubmit} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                        <input
                          type="text"
                          required
                          className="input"
                          placeholder="Enter Customer Name"
                          value={newCustomerForm.name}
                          onChange={(e) => setNewCustomerForm({ ...newCustomerForm, name: e.target.value })}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                        <input
                          type="email"
                          className="input"
                          placeholder="Enter Email"
                          value={newCustomerForm.email}
                          onChange={(e) => setNewCustomerForm({ ...newCustomerForm, email: e.target.value })}
                        />
                      </div>
                      <div className="col-span-2 md:col-span-1">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Is Taxable</label>
                        <select
                          className="input"
                          value={newCustomerForm.is_taxable ? 'Yes' : 'No'}
                          onChange={(e) => setNewCustomerForm({ ...newCustomerForm, is_taxable: e.target.value === 'Yes' })}
                        >
                          <option value="Yes">Yes</option>
                          <option value="No">No</option>
                        </select>
                      </div>
                      <div className="col-span-2 md:col-span-1">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Tax Number</label>
                        <input
                          type="text"
                          className="input"
                          placeholder="Enter Tax Number"
                          value={newCustomerForm.tax_number}
                          onChange={(e) => setNewCustomerForm({ ...newCustomerForm, tax_number: e.target.value })}
                          disabled={!newCustomerForm.is_taxable}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                        <input
                          type="tel"
                          className="input"
                          placeholder="Enter Phone Number"
                          value={newCustomerForm.phone}
                          onChange={(e) => setNewCustomerForm({ ...newCustomerForm, phone: e.target.value })}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Vehicle Number</label>
                        <input
                          type="text"
                          className="input"
                          placeholder="Enter Vehicle Number"
                          value={newCustomerForm.vehicle_number}
                          onChange={(e) => setNewCustomerForm({ ...newCustomerForm, vehicle_number: e.target.value })}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Credit Limit</label>
                        <input
                          type="number"
                          step="0.01"
                          className="input"
                          value={newCustomerForm.credit_limit}
                          onChange={(e) => setNewCustomerForm({ ...newCustomerForm, credit_limit: parseFloat(e.target.value) || 0 })}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Current Balance</label>
                        <input
                          type="number"
                          step="0.01"
                          className="input"
                          value={newCustomerForm.current_balance}
                          onChange={(e) => setNewCustomerForm({ ...newCustomerForm, current_balance: parseFloat(e.target.value) || 0 })}
                        />
                      </div>
                    </div>
                    <hr />
                    <h3 className="text-lg font-medium text-gray-900 mb-4">Addresses - Billing</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label htmlFor="billing_address" className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                        <input
                          type="text"
                          id="billing_address"
                          className="input"
                          placeholder="Enter Billing Address"
                          value={newCustomerForm.billing_address}
                          onChange={(e) => setNewCustomerForm({ ...newCustomerForm, billing_address: e.target.value })}
                          required
                        />
                      </div>
                      <div>
                        <label htmlFor="billing_city" className="block text-sm font-medium text-gray-700 mb-1">City</label>
                        <input
                          type="text"
                          id="billing_city"
                          className="input"
                          placeholder="Enter City"
                          value={newCustomerForm.billing_city}
                          onChange={(e) => setNewCustomerForm({ ...newCustomerForm, billing_city: e.target.value })}
                          required
                        />
                      </div>
                      <div>
                        <label htmlFor="billing_province" className="block text-sm font-medium text-gray-700 mb-1">Province</label>
                        <select
                          id="billing_province"
                          className="input"
                          value={newCustomerForm.billing_province}
                          onChange={(e) => setNewCustomerForm({ ...newCustomerForm, billing_province: e.target.value })}
                          required
                        >
                          <option value="">Select Province</option>
                          <option value="Central">Central Province</option>
                          <option value="Eastern">Eastern Province</option>
                          <option value="Northern">Northern Province</option>
                          <option value="Southern">Southern Province</option>
                          <option value="Western">Western Province</option>
                          <option value="North Western">North Western Province</option>
                          <option value="North Central">North Central Province</option>
                          <option value="Uva">Uva Province</option>
                          <option value="Sabaragamuwa">Sabaragamuwa Province</option>
                        </select>
                      </div>
                      <div>
                        <label htmlFor="billing_postal_code" className="block text-sm font-medium text-gray-700 mb-1">Postal Code</label>
                        <input
                          type="text"
                          id="billing_postal_code"
                          className="input"
                          placeholder="Enter Postal Code"
                          value={newCustomerForm.billing_postal_code}
                          onChange={(e) => setNewCustomerForm({ ...newCustomerForm, billing_postal_code: e.target.value })}
                          required
                        />
                      </div>
                      <div>
                        <label htmlFor="billing_country" className="block text-sm font-medium text-gray-700 mb-1">Country</label>
                        <input
                          type="text"
                          id="billing_country"
                          className="input"
                          placeholder="Enter Country"
                          value={newCustomerForm.billing_country}
                          onChange={(e) => setNewCustomerForm({ ...newCustomerForm, billing_country: e.target.value })}
                          required
                        />
                      </div>
                    </div>
                    <div className="col-12">
                      <p className="mt-3">
                        <strong>Entered Billing Address:</strong>{' '}
                        {renderAddress({
                          address: newCustomerForm.billing_address,
                          city: newCustomerForm.billing_city,
                          province: newCustomerForm.billing_province,
                          postal_code: newCustomerForm.billing_postal_code,
                          country: newCustomerForm.billing_country
                        })}
                      </p>
                    </div>
                    <h3 className="text-lg font-medium text-gray-900 mb-4">Addresses - Shipping</h3>
                    <div className="col-12 mb-4">
                      <div className="form-check">
                        <input
                          className="form-check-input"
                          type="checkbox"
                          id="sameAsBilling"
                          checked={newCustomerForm.shipping_same_as_billing}
                          onChange={(e) => setNewCustomerForm({ ...newCustomerForm, shipping_same_as_billing: e.target.checked })}
                        />
                        <label className="form-check-label" htmlFor="sameAsBilling">
                          Shipping address same as billing address
                        </label>
                      </div>
                    </div>
                    {!newCustomerForm.shipping_same_as_billing && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label htmlFor="shipping_address" className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                          <input
                            type="text"
                            id="shipping_address"
                            className="input"
                            placeholder="Enter Shipping Address"
                            value={newCustomerForm.shipping_address}
                            onChange={(e) => setNewCustomerForm({ ...newCustomerForm, shipping_address: e.target.value })}
                          />
                        </div>
                        <div>
                          <label htmlFor="shipping_city" className="block text-sm font-medium text-gray-700 mb-1">City</label>
                          <input
                            type="text"
                            id="shipping_city"
                            className="input"
                            placeholder="Enter City"
                            value={newCustomerForm.shipping_city}
                            onChange={(e) => setNewCustomerForm({ ...newCustomerForm, shipping_city: e.target.value })}
                          />
                        </div>
                        <div>
                          <label htmlFor="shipping_province" className="block text-sm font-medium text-gray-700 mb-1">Province</label>
                          <select
                            id="shipping_province"
                            className="input"
                            value={newCustomerForm.shipping_province}
                            onChange={(e) => setNewCustomerForm({ ...newCustomerForm, shipping_province: e.target.value })}
                          >
                            <option value="">Select Province</option>
                            <option value="Central">Central Province</option>
                            <option value="Eastern">Eastern Province</option>
                            <option value="Northern">Northern Province</option>
                            <option value="Southern">Southern Province</option>
                            <option value="Western">Western Province</option>
                            <option value="North Western">North Western Province</option>
                            <option value="North Central">North Central Province</option>
                            <option value="Uva">Uva Province</option>
                            <option value="Sabaragamuwa">Sabaragamuwa Province</option>
                          </select>
                        </div>
                        <div>
                          <label htmlFor="shipping_postal_code" className="block text-sm font-medium text-gray-700 mb-1">Postal Code</label>
                          <input
                            type="text"
                            id="shipping_postal_code"
                            className="input"
                            placeholder="Enter Postal Code"
                            value={newCustomerForm.shipping_postal_code}
                            onChange={(e) => setNewCustomerForm({ ...newCustomerForm, shipping_postal_code: e.target.value })}
                          />
                        </div>
                        <div>
                          <label htmlFor="shipping_country" className="block text-sm font-medium text-gray-700 mb-1">Country</label>
                          <input
                            type="text"
                            id="shipping_country"
                            className="input"
                            placeholder="Enter Country"
                            value={newCustomerForm.shipping_country}
                            onChange={(e) => setNewCustomerForm({ ...newCustomerForm, shipping_country: e.target.value })}
                          />
                        </div>
                      </div>
                    )}
                    {!newCustomerForm.shipping_same_as_billing && (
                      <div className="col-12">
                        <p className="mt-3">
                          <strong>Entered Shipping Address:</strong>{' '}
                          {renderAddress({
                            address: newCustomerForm.shipping_address,
                            city: newCustomerForm.shipping_city,
                            province: newCustomerForm.shipping_province,
                            postal_code: newCustomerForm.shipping_postal_code,
                            country: newCustomerForm.shipping_country
                          })}
                        </p>
                      </div>
                    )}
                    <hr />
                    <h3 className="text-lg font-medium text-gray-900 mb-4">Payments</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label htmlFor="primary_payment_method" className="block text-sm font-medium text-gray-700 mb-1">Primary Payment Method</label>
                        <select
                          id="primary_payment_method"
                          className="input"
                          value={newCustomerForm.primary_payment_method}
                          onChange={(e) => setNewCustomerForm({ ...newCustomerForm, primary_payment_method: e.target.value })}
                          required
                        >
                          <option value="">Select Payment Method</option>
                          <option value="cash">Cash</option>
                          <option value="cashdeposit">Cash Deposit</option>
                          <option value="cheque">Cheque</option>
                          <option value="creditcard">Credit Card</option>
                          <option value="creditnote">Credit Note</option>
                          <option value="debitcard">Debit Card</option>
                          <option value="directdebit">Direct Debit</option>
                          <option value="other">Other</option>
                          <option value="salesreturn">Sales Return</option>
                        </select>
                      </div>
                      <div>
                        <label htmlFor="terms" className="block text-sm font-medium text-gray-700 mb-1">Terms</label>
                        <select
                          id="terms"
                          className="input"
                          value={newCustomerForm.terms}
                          onChange={(e) => setNewCustomerForm({ ...newCustomerForm, terms: e.target.value })}
                          required
                        >
                          <option value="">Select Terms</option>
                          <option value="dueonreceipt">Due on Receipt</option>
                          <option value="net15">Net 15</option>
                          <option value="net30">Net 30</option>
                          <option value="net60">Net 60</option>
                        </select>
                      </div>
                      <div>
                        <label htmlFor="delivery_option" className="block text-sm font-medium text-gray-700 mb-1">Delivery Option</label>
                        <select
                          id="delivery_option"
                          className="input"
                          value={newCustomerForm.delivery_option}
                          onChange={(e) => setNewCustomerForm({ ...newCustomerForm, delivery_option: e.target.value })}
                          required
                        >
                          <option value="">Select Delivery Option</option>
                          <option value="printLater">Print Later</option>
                          <option value="sendLater">Send Later</option>
                          <option value="none">None</option>
                          <option value="useCompanyDefault">Use Company Default</option>
                        </select>
                      </div>
                      <div>
                        <label htmlFor="invoice_language" className="block text-sm font-medium text-gray-700 mb-1">Invoice Language</label>
                        <select
                          id="invoice_language"
                          className="input"
                          value={newCustomerForm.invoice_language}
                          onChange={(e) => setNewCustomerForm({ ...newCustomerForm, invoice_language: e.target.value })}
                          required
                        >
                          <option value="">Select Language</option>
                          <option value="english">English</option>
                          <option value="spanish">Spanish</option>
                          <option value="french">French</option>
                          <option value="italian">Italian</option>
                          <option value="chinese">Chinese (Traditional)</option>
                          <option value="portuguese">Portuguese (Brazil)</option>
                        </select>
                      </div>
                    </div>
                    <hr />
                    <h3 className="text-lg font-medium text-gray-900 mb-4">Additional Info</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label htmlFor="sales_tax_registration" className="block text-sm font-medium text-gray-700 mb-1">Sales Tax Registration</label>
                        <input
                          type="text"
                          id="sales_tax_registration"
                          className="input"
                          placeholder="Enter Sales Tax Registration"
                          value={newCustomerForm.sales_tax_registration}
                          onChange={(e) => setNewCustomerForm({ ...newCustomerForm, sales_tax_registration: e.target.value })}
                          required
                        />
                      </div>
                      <div>
                        <label htmlFor="opening_balance" className="block text-sm font-medium text-gray-700 mb-1">Opening Balance</label>
                        <input
                          type="number"
                          id="opening_balance"
                          className="input"
                          placeholder="Enter Opening Balance"
                          value={newCustomerForm.opening_balance}
                          onChange={(e) => setNewCustomerForm({ ...newCustomerForm, opening_balance: parseFloat(e.target.value) || 0 })}
                          required
                        />
                      </div>
                      <div>
                        <label htmlFor="as_of_date" className="block text-sm font-medium text-gray-700 mb-1">As of Date</label>
                        <input
                          type="date"
                          id="as_of_date"
                          className="input"
                          value={newCustomerForm.as_of_date}
                          onChange={(e) => setNewCustomerForm({ ...newCustomerForm, as_of_date: e.target.value })}
                        />
                      </div>
                    </div>
                    <div className="flex justify-end space-x-3 pt-4">
                      <button
                        type="button"
                        onClick={() => setShowCustomerModal(false)}
                        className="btn btn-secondary btn-md"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="btn btn-primary btn-md"
                      >
                        Create Customer
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}