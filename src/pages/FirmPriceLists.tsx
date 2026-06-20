import React, { useState, useEffect, useCallback } from 'react';
import {
  Plus, Edit2, Trash2, Save, X, Building2, DollarSign,
  ChevronDown, ChevronUp, AlertCircle, CheckCircle, Loader2, Search
} from 'lucide-react';
import { supabase } from '@/lib/supabase';

// ─── Types ────────────────────────────────────────────────────────────────────

interface SolicitorFirm {
  id: string;
  name: string;
  is_active: boolean;
}

interface PriceListRow {
  id: string;
  firm_id: string;
  transaction_type: string;
  property_type: string;
  min_value: number;
  max_value: number | null;
  legal_fee_ex_vat: number;
  vat_rate: number;
  fee_rules: any[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface SupplementRow {
  id: string;
  firm_id: string;
  name: string;
  amount: number;
  is_percentage: boolean;
  per_person: boolean;
  vat_applicable: boolean;
  trigger_condition: string;
  transaction_types: string[];
  category: 'supplement' | 'third_party_fee';
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

const TRANSACTION_TYPES = ['Purchase', 'Sale', 'Sale & Purchase', 'Remortgage'] as const;
const PROPERTY_TYPES = ['Freehold', 'Leasehold'] as const;

const TRIGGER_CONDITIONS = [
  { value: 'always', label: 'Always (applied to every quote)' },
  { value: 'mortgaged', label: 'Mortgaged' },
  { value: 'leasehold', label: 'Leasehold' },
  { value: 'new_build', label: 'New Build' },
  { value: 'shared_ownership', label: 'Shared Ownership' },
  { value: 'buy_to_let', label: 'Buy to Let / Second Home' },
  { value: 'unregistered', label: 'Unregistered Land' },
  { value: 'help_to_buy', label: 'Help to Buy' },
  { value: 'right_to_buy', label: 'Right to Buy' },
  { value: 'auction', label: 'Auction / Repossession' },
  { value: 'gifted_deposit', label: 'Gifted Deposit' },
  { value: 'second_home', label: 'Second Home' },
  { value: 'first_time_buyer', label: 'First Time Buyer' },
] as const;

const EMPTY_PRICE: Omit<PriceListRow, 'id' | 'created_at' | 'updated_at'> = {
  firm_id: '',
  transaction_type: 'Purchase',
  property_type: 'Freehold',
  min_value: 0,
  max_value: null,
  legal_fee_ex_vat: 0,
  vat_rate: 20,
  fee_rules: [],
  is_active: true,
};

const EMPTY_SUPPLEMENT: Omit<SupplementRow, 'id' | 'created_at' | 'updated_at'> = {
  firm_id: '',
  name: '',
  amount: 0,
  is_percentage: false,
  per_person: false,
  vat_applicable: true,
  trigger_condition: 'always',
  transaction_types: [],
  category: 'supplement',
  is_active: true,
  sort_order: 0,
};

// ─── Component ────────────────────────────────────────────────────────────────

export const FirmPriceLists: React.FC = () => {
  const [firms, setFirms] = useState<SolicitorFirm[]>([]);
  const [priceLists, setPriceLists] = useState<PriceListRow[]>([]);
  const [supplements, setSupplements] = useState<SupplementRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedFirm, setExpandedFirm] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'prices' | 'supplements'>('prices');

  // Price modal state
  const [showModal, setShowModal] = useState(false);
  const [editingPrice, setEditingPrice] = useState<PriceListRow | null>(null);
  const [formData, setFormData] = useState<Omit<PriceListRow, 'id' | 'created_at' | 'updated_at'>>(EMPTY_PRICE);
  const [isSaving, setIsSaving] = useState(false);

  // Supplement modal state
  const [showSuppModal, setShowSuppModal] = useState(false);
  const [editingSupplement, setEditingSupplement] = useState<SupplementRow | null>(null);
  const [suppFormData, setSuppFormData] = useState<Omit<SupplementRow, 'id' | 'created_at' | 'updated_at'>>(EMPTY_SUPPLEMENT);

  // Feedback
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [showSuppDeleteConfirm, setShowSuppDeleteConfirm] = useState<string | null>(null);

  // ─── Load Data ───────────────────────────────────────────────────────────

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [firmsRes, pricesRes, suppsRes] = await Promise.all([
        supabase.from('solicitor_firms').select('id, name, is_active').eq('is_active', true).order('name'),
        supabase.from('firm_price_lists').select('*').order('transaction_type, property_type, min_value'),
        supabase.from('firm_supplements').select('*').order('sort_order, name'),
      ]);

      if (firmsRes.error) throw firmsRes.error;
      if (pricesRes.error) throw pricesRes.error;

      setFirms(firmsRes.data || []);
      setPriceLists(pricesRes.data || []);
      setSupplements(suppsRes.error ? [] : (suppsRes.data || []));
    } catch (err: any) {
      console.error('Error loading data:', err);
      showToast('error', 'Failed to load data: ' + (err.message || 'Unknown error'));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // ─── Toast ───────────────────────────────────────────────────────────────

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  };

  // ─── CRUD ────────────────────────────────────────────────────────────────

  const openAddModal = (firmId: string) => {
    setEditingPrice(null);
    setFormData({ ...EMPTY_PRICE, firm_id: firmId });
    setShowModal(true);
  };

  const openEditModal = (price: PriceListRow) => {
    setEditingPrice(price);
    setFormData({
      firm_id: price.firm_id,
      transaction_type: price.transaction_type,
      property_type: price.property_type,
      min_value: price.min_value,
      max_value: price.max_value,
      legal_fee_ex_vat: price.legal_fee_ex_vat,
      vat_rate: price.vat_rate,
      fee_rules: price.fee_rules,
      is_active: price.is_active,
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (formData.legal_fee_ex_vat <= 0) {
      showToast('error', 'Legal fee must be greater than 0');
      return;
    }
    setIsSaving(true);
    try {
      const payload = {
        firm_id: formData.firm_id,
        transaction_type: formData.transaction_type,
        property_type: formData.property_type,
        min_value: formData.min_value,
        max_value: formData.max_value,
        legal_fee_ex_vat: formData.legal_fee_ex_vat,
        vat_rate: formData.vat_rate,
        fee_rules: formData.fee_rules,
        is_active: formData.is_active,
        updated_at: new Date().toISOString(),
      };

      if (editingPrice) {
        const { error } = await supabase
          .from('firm_price_lists')
          .update(payload)
          .eq('id', editingPrice.id);
        if (error) throw error;
        showToast('success', 'Price list updated successfully');
      } else {
        const { error } = await supabase
          .from('firm_price_lists')
          .insert(payload);
        if (error) throw error;
        showToast('success', 'Price list added successfully');
      }

      setShowModal(false);
      loadData();
    } catch (err: any) {
      showToast('error', 'Failed to save: ' + (err.message || 'Unknown error'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from('firm_price_lists')
        .delete()
        .eq('id', id);
      if (error) throw error;
      showToast('success', 'Price list entry deleted');
      setShowDeleteConfirm(null);
      loadData();
    } catch (err: any) {
      showToast('error', 'Failed to delete: ' + (err.message || 'Unknown error'));
    }
  };

  // ─── Quick Fill ──────────────────────────────────────────────────────────

  const handleQuickFill = async (firmId: string, baseFee: number) => {
    setIsSaving(true);
    try {
      const entries = [];
      for (const tt of TRANSACTION_TYPES) {
        for (const pt of PROPERTY_TYPES) {
          const adjust = tt === 'Sale' ? -50 : tt === 'Remortgage' ? 30 : 0;
          entries.push({
            firm_id: firmId,
            transaction_type: tt,
            property_type: pt,
            min_value: 0,
            max_value: null,
            legal_fee_ex_vat: baseFee + adjust,
            vat_rate: 20,
            fee_rules: [],
            is_active: true,
          });
        }
      }
      const { error } = await supabase.from('firm_price_lists').insert(entries);
      if (error) throw error;
      showToast('success', `Created ${entries.length} price list entries`);
      loadData();
    } catch (err: any) {
      showToast('error', 'Quick fill failed: ' + (err.message || 'Unknown error'));
    } finally {
      setIsSaving(false);
    }
  };

  // ─── Supplement CRUD ────────────────────────────────────────────────────

  const openAddSuppModal = (firmId: string) => {
    setEditingSupplement(null);
    setSuppFormData({ ...EMPTY_SUPPLEMENT, firm_id: firmId });
    setShowSuppModal(true);
  };

  const openEditSuppModal = (supp: SupplementRow) => {
    setEditingSupplement(supp);
    setSuppFormData({
      firm_id: supp.firm_id,
      name: supp.name,
      amount: supp.amount,
      is_percentage: supp.is_percentage,
      per_person: supp.per_person ?? false,
      vat_applicable: supp.vat_applicable,
      trigger_condition: supp.trigger_condition,
      transaction_types: supp.transaction_types || [],
      category: supp.category,
      is_active: supp.is_active,
      sort_order: supp.sort_order,
    });
    setShowSuppModal(true);
  };

  const handleSaveSupplement = async () => {
    if (!suppFormData.name.trim()) {
      showToast('error', 'Supplement name is required');
      return;
    }
    if (suppFormData.amount <= 0) {
      showToast('error', 'Amount must be greater than 0');
      return;
    }
    setIsSaving(true);
    try {
      const payload = {
        firm_id: suppFormData.firm_id,
        name: suppFormData.name.trim(),
        amount: suppFormData.amount,
        is_percentage: suppFormData.is_percentage,
        per_person: suppFormData.per_person,
        vat_applicable: suppFormData.vat_applicable,
        trigger_condition: suppFormData.trigger_condition,
        transaction_types: suppFormData.transaction_types,
        category: suppFormData.category,
        is_active: suppFormData.is_active,
        sort_order: suppFormData.sort_order,
        updated_at: new Date().toISOString(),
      };

      if (editingSupplement) {
        const { error } = await supabase
          .from('firm_supplements')
          .update(payload)
          .eq('id', editingSupplement.id);
        if (error) throw error;
        showToast('success', 'Supplement updated');
      } else {
        const { error } = await supabase
          .from('firm_supplements')
          .insert(payload);
        if (error) throw error;
        showToast('success', 'Supplement added');
      }

      setShowSuppModal(false);
      loadData();
    } catch (err: any) {
      showToast('error', 'Failed to save supplement: ' + (err.message || 'Unknown error'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteSupplement = async (id: string) => {
    try {
      const { error } = await supabase
        .from('firm_supplements')
        .delete()
        .eq('id', id);
      if (error) throw error;
      showToast('success', 'Supplement deleted');
      setShowSuppDeleteConfirm(null);
      loadData();
    } catch (err: any) {
      showToast('error', 'Failed to delete supplement: ' + (err.message || 'Unknown error'));
    }
  };

  // ─── Helpers ─────────────────────────────────────────────────────────────

  const firmPrices = (firmId: string) => priceLists.filter(p => p.firm_id === firmId);
  const firmSupps = (firmId: string) => supplements.filter(s => s.firm_id === firmId);

  const filteredFirms = firms.filter(
    (f) => f.is_active && f.name.toLowerCase().includes(search.toLowerCase())
  );

  const formatCurrency = (v: number) =>
    new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(v);

  // ─── Render ──────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <DollarSign className="w-6 h-6 text-purple-600" />
            Firm Price Lists
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage per-firm legal fees by transaction type, property type, and value band. These prices are used by the comparison engine.
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="relative mb-4 max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          placeholder="Search firms..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none"
        />
      </div>

      {/* Firm list */}
      <div className="space-y-3">
        {filteredFirms.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <Building2 className="w-10 h-10 mx-auto mb-3 text-gray-300" />
            <p className="font-medium">No solicitor firms found</p>
            <p className="text-sm mt-1">Add firms via the Solicitor Firms page first.</p>
          </div>
        ) : (
          filteredFirms.map((firm) => {
            const prices = firmPrices(firm.id);
            const isExpanded = expandedFirm === firm.id;

            return (
              <div key={firm.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                {/* Firm header row */}
                <button
                  onClick={() => setExpandedFirm(isExpanded ? null : firm.id)}
                  className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors text-left"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-white text-xs font-bold ${firm.is_active ? 'bg-[#011E41]' : 'bg-gray-400'}`}>
                      {firm.name.substring(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <span className="font-semibold text-gray-900">{firm.name}</span>
                      {!firm.is_active && <span className="ml-2 text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">Inactive</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-gray-500">{prices.length} price{prices.length !== 1 ? 's' : ''}</span>
                    {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                  </div>
                </button>

                {/* Expanded content */}
                {isExpanded && (
                  <div className="border-t border-gray-100 bg-gray-50/50">
                    {/* Tabs */}
                    <div className="flex border-b border-gray-200 px-4 pt-3">
                      <button
                        onClick={() => setActiveTab('prices')}
                        className={`px-4 py-2 text-xs font-medium border-b-2 transition-colors ${
                          activeTab === 'prices'
                            ? 'border-purple-600 text-purple-600'
                            : 'border-transparent text-gray-500 hover:text-gray-700'
                        }`}
                      >
                        Price Lists ({prices.length})
                      </button>
                      <button
                        onClick={() => setActiveTab('supplements')}
                        className={`px-4 py-2 text-xs font-medium border-b-2 transition-colors ${
                          activeTab === 'supplements'
                            ? 'border-purple-600 text-purple-600'
                            : 'border-transparent text-gray-500 hover:text-gray-700'
                        }`}
                      >
                        Supplements ({firmSupps(firm.id).length})
                      </button>
                    </div>

                    <div className="p-4">
                      {activeTab === 'prices' ? (
                        <>
                          {/* Price Actions */}
                          <div className="flex items-center gap-2 mb-4">
                            <button onClick={() => openAddModal(firm.id)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 text-white text-xs font-medium rounded-lg hover:bg-purple-700 transition-colors">
                              <Plus className="w-3.5 h-3.5" /> Add Price
                            </button>
                            {prices.length === 0 && (
                              <button onClick={() => {
                                const fee = prompt('Enter base legal fee (ex VAT) for quick fill:', '550');
                                if (fee && !isNaN(Number(fee))) handleQuickFill(firm.id, Number(fee));
                              }}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 text-gray-700 text-xs font-medium rounded-lg hover:bg-gray-200 transition-colors">
                                Quick Fill All Types
                              </button>
                            )}
                          </div>

                          {prices.length === 0 ? (
                            <p className="text-sm text-gray-400 py-4 text-center">No price lists yet. Add individual entries or use Quick Fill.</p>
                          ) : (
                            <div className="overflow-x-auto">
                              <table className="w-full text-sm">
                                <thead>
                                  <tr className="border-b border-gray-200 text-gray-500 text-xs uppercase tracking-wider">
                                    <th className="py-2 px-3 text-left">Transaction</th>
                                    <th className="py-2 px-3 text-left">Property</th>
                                    <th className="py-2 px-3 text-right">Min Value</th>
                                    <th className="py-2 px-3 text-right">Max Value</th>
                                    <th className="py-2 px-3 text-right">Legal Fee (ex VAT)</th>
                                    <th className="py-2 px-3 text-right">VAT %</th>
                                    <th className="py-2 px-3 text-center">Active</th>
                                    <th className="py-2 px-3 text-right">Actions</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                  {prices.map((p) => (
                                    <tr key={p.id} className="hover:bg-white transition-colors">
                                      <td className="py-2.5 px-3">
                                        <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                                          p.transaction_type === 'Purchase' ? 'bg-blue-50 text-blue-700' :
                                          p.transaction_type === 'Sale' ? 'bg-green-50 text-green-700' :
                                          p.transaction_type === 'Sale & Purchase' ? 'bg-purple-50 text-purple-700' :
                                          'bg-orange-50 text-orange-700'
                                        }`}>
                                          {p.transaction_type}
                                        </span>
                                      </td>
                                      <td className="py-2.5 px-3 text-gray-700">{p.property_type}</td>
                                      <td className="py-2.5 px-3 text-right text-gray-600">{formatCurrency(p.min_value)}</td>
                                      <td className="py-2.5 px-3 text-right text-gray-600">{p.max_value != null ? formatCurrency(p.max_value) : '—'}</td>
                                      <td className="py-2.5 px-3 text-right font-semibold text-gray-900">{formatCurrency(p.legal_fee_ex_vat)}</td>
                                      <td className="py-2.5 px-3 text-right text-gray-600">{p.vat_rate}%</td>
                                      <td className="py-2.5 px-3 text-center">
                                        {p.is_active ? (
                                          <CheckCircle className="w-4 h-4 text-green-500 mx-auto" />
                                        ) : (
                                          <X className="w-4 h-4 text-gray-300 mx-auto" />
                                        )}
                                      </td>
                                      <td className="py-2.5 px-3 text-right">
                                        <div className="flex items-center justify-end gap-1">
                                          <button onClick={() => openEditModal(p)}
                                            className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors" title="Edit">
                                            <Edit2 className="w-3.5 h-3.5" />
                                          </button>
                                          <button onClick={() => setShowDeleteConfirm(p.id)}
                                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors" title="Delete">
                                            <Trash2 className="w-3.5 h-3.5" />
                                          </button>
                                        </div>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </>
                      ) : (
                        <>
                          {/* Supplements Tab */}
                          <div className="flex items-center gap-2 mb-4">
                            <button onClick={() => openAddSuppModal(firm.id)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 text-white text-xs font-medium rounded-lg hover:bg-purple-700 transition-colors">
                              <Plus className="w-3.5 h-3.5" /> Add Supplement
                            </button>
                          </div>

                          {firmSupps(firm.id).length === 0 ? (
                            <p className="text-sm text-gray-400 py-4 text-center">
                              No supplements configured. Add fees like mortgage admin, ID checks, etc.
                            </p>
                          ) : (
                            <div className="overflow-x-auto">
                              <table className="w-full text-sm">
                                <thead>
                                  <tr className="border-b border-gray-200 text-gray-500 text-xs uppercase tracking-wider">
                                    <th className="py-2 px-3 text-left">Name</th>
                                    <th className="py-2 px-3 text-left">Category</th>
                                    <th className="py-2 px-3 text-right">Amount</th>
                                    <th className="py-2 px-3 text-center">Per Person</th>
                                    <th className="py-2 px-3 text-left">Trigger</th>
                                    <th className="py-2 px-3 text-left">Applies To</th>
                                    <th className="py-2 px-3 text-center">VAT</th>
                                    <th className="py-2 px-3 text-center">Active</th>
                                    <th className="py-2 px-3 text-right">Actions</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                  {firmSupps(firm.id).map((s) => (
                                    <tr key={s.id} className="hover:bg-white transition-colors">
                                      <td className="py-2.5 px-3 font-medium text-gray-900">{s.name}</td>
                                      <td className="py-2.5 px-3">
                                        <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                                          s.category === 'third_party_fee'
                                            ? 'bg-amber-50 text-amber-700'
                                            : 'bg-purple-50 text-purple-700'
                                        }`}>
                                          {s.category === 'third_party_fee' ? '3rd Party Fee' : 'Supplement'}
                                        </span>
                                      </td>
                                      <td className="py-2.5 px-3 text-right font-semibold text-gray-900">
                                        {s.is_percentage ? `${s.amount}%` : formatCurrency(s.amount)}
                                      </td>
                                      <td className="py-2.5 px-3 text-center text-xs text-gray-500">
                                        {s.per_person ? 'Yes' : 'No'}
                                      </td>
                                      <td className="py-2.5 px-3">
                                        <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-700">
                                          {TRIGGER_CONDITIONS.find(t => t.value === s.trigger_condition)?.label || s.trigger_condition}
                                        </span>
                                      </td>
                                      <td className="py-2.5 px-3 text-gray-600 text-xs">
                                        {s.transaction_types.length === 0 ? 'All types' : s.transaction_types.join(', ')}
                                      </td>
                                      <td className="py-2.5 px-3 text-center text-xs text-gray-500">
                                        {s.vat_applicable ? 'Yes' : 'No'}
                                      </td>
                                      <td className="py-2.5 px-3 text-center">
                                        {s.is_active ? (
                                          <CheckCircle className="w-4 h-4 text-green-500 mx-auto" />
                                        ) : (
                                          <X className="w-4 h-4 text-gray-300 mx-auto" />
                                        )}
                                      </td>
                                      <td className="py-2.5 px-3 text-right">
                                        <div className="flex items-center justify-end gap-1">
                                          <button onClick={() => openEditSuppModal(s)}
                                            className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors" title="Edit">
                                            <Edit2 className="w-3.5 h-3.5" />
                                          </button>
                                          <button onClick={() => setShowSuppDeleteConfirm(s.id)}
                                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors" title="Delete">
                                            <Trash2 className="w-3.5 h-3.5" />
                                          </button>
                                        </div>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* ─── Add/Edit Modal ──────────────────────────────────────────────── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-gray-900">
                {editingPrice ? 'Edit Price List Entry' : 'Add Price List Entry'}
              </h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>

            <div className="space-y-4">
              {/* Transaction Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Transaction Type</label>
                <select value={formData.transaction_type} onChange={(e) => setFormData(p => ({ ...p, transaction_type: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none">
                  {TRANSACTION_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>

              {/* Property Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Property Type</label>
                <select value={formData.property_type} onChange={(e) => setFormData(p => ({ ...p, property_type: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none">
                  {PROPERTY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>

              {/* Value band */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Min Property Value</label>
                  <input type="number" value={formData.min_value} onChange={(e) => setFormData(p => ({ ...p, min_value: Number(e.target.value) }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Max Property Value</label>
                  <input type="number" value={formData.max_value ?? ''} placeholder="No limit"
                    onChange={(e) => setFormData(p => ({ ...p, max_value: e.target.value ? Number(e.target.value) : null }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none" />
                </div>
              </div>

              {/* Legal Fee */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Legal Fee (ex VAT)</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">£</span>
                  <input type="number" step="0.01" value={formData.legal_fee_ex_vat}
                    onChange={(e) => setFormData(p => ({ ...p, legal_fee_ex_vat: Number(e.target.value) }))}
                    className="w-full border border-gray-200 rounded-lg pl-7 pr-3 py-2 text-sm focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none" />
                </div>
              </div>

              {/* VAT Rate */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">VAT Rate (%)</label>
                <input type="number" step="0.1" value={formData.vat_rate}
                  onChange={(e) => setFormData(p => ({ ...p, vat_rate: Number(e.target.value) }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none" />
              </div>

              {/* Active */}
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={formData.is_active}
                  onChange={() => setFormData(p => ({ ...p, is_active: !p.is_active }))}
                  className="h-4 w-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500" />
                <span className="text-sm text-gray-700">Active</span>
              </label>
            </div>

            {/* Footer */}
            <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-gray-100">
              <button onClick={() => setShowModal(false)}
                className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
                Cancel
              </button>
              <button onClick={handleSave} disabled={isSaving}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 disabled:opacity-50 transition-colors">
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {editingPrice ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Delete Confirm ──────────────────────────────────────────────── */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full p-6 text-center">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-3" />
            <h3 className="text-lg font-bold text-gray-900 mb-2">Delete Price Entry?</h3>
            <p className="text-sm text-gray-500 mb-5">This action cannot be undone.</p>
            <div className="flex justify-center gap-2">
              <button onClick={() => setShowDeleteConfirm(null)}
                className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">
                Cancel
              </button>
              <button onClick={() => handleDelete(showDeleteConfirm)}
                className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700">
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Supplement Add/Edit Modal ─────────────────────────────────── */}
      {showSuppModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-gray-900">
                {editingSupplement ? 'Edit Supplement' : 'Add Supplement'}
              </h2>
              <button onClick={() => setShowSuppModal(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>

            <div className="space-y-4">
              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Supplement Name</label>
                <input type="text" placeholder="e.g. Mortgage Admin Fee"
                  value={suppFormData.name}
                  onChange={(e) => setSuppFormData(p => ({ ...p, name: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none" />
              </div>

              {/* Amount + Type */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Amount</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">
                      {suppFormData.is_percentage ? '%' : '£'}
                    </span>
                    <input type="number" step="0.01" value={suppFormData.amount}
                      onChange={(e) => setSuppFormData(p => ({ ...p, amount: Number(e.target.value) }))}
                      className="w-full border border-gray-200 rounded-lg pl-7 pr-3 py-2 text-sm focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Fee Type</label>
                  <select value={suppFormData.is_percentage ? 'percentage' : 'fixed'}
                    onChange={(e) => setSuppFormData(p => ({ ...p, is_percentage: e.target.value === 'percentage' }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none">
                    <option value="fixed">Fixed Amount (£)</option>
                    <option value="percentage">Percentage (%)</option>
                  </select>
                </div>
              </div>

              {/* Category */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                <select value={suppFormData.category}
                  onChange={(e) => setSuppFormData(p => ({ ...p, category: e.target.value as 'supplement' | 'third_party_fee' }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none">
                  <option value="supplement">Supplement</option>
                  <option value="third_party_fee">Fees Payable to Third Parties</option>
                </select>
                <p className="text-xs text-gray-400 mt-1">Supplements are firm charges. Third-party fees are disbursements (e.g. OS1, Bankruptcy Search).</p>
              </div>

              {/* Trigger Condition */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Trigger Condition</label>
                <select value={suppFormData.trigger_condition}
                  onChange={(e) => setSuppFormData(p => ({ ...p, trigger_condition: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none">
                  {TRIGGER_CONDITIONS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
                <p className="text-xs text-gray-400 mt-1">This supplement is added when the selected condition is met.</p>
              </div>

              {/* Transaction Types */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Applies to Transaction Types</label>
                <div className="flex flex-wrap gap-2 mt-1">
                  {TRANSACTION_TYPES.map(tt => {
                    const selected = suppFormData.transaction_types.includes(tt);
                    return (
                      <button key={tt} type="button"
                        onClick={() => {
                          setSuppFormData(p => ({
                            ...p,
                            transaction_types: selected
                              ? p.transaction_types.filter(t => t !== tt)
                              : [...p.transaction_types, tt],
                          }));
                        }}
                        className={`px-2.5 py-1 text-xs rounded-lg border transition-colors ${
                          selected
                            ? 'bg-purple-50 border-purple-300 text-purple-700'
                            : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'
                        }`}
                      >
                        {tt}
                      </button>
                    );
                  })}
                </div>
                <p className="text-xs text-gray-400 mt-1">Leave empty for all transaction types.</p>
              </div>

              {/* Checkboxes */}
              <div className="flex flex-wrap gap-6">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={suppFormData.per_person}
                    onChange={() => setSuppFormData(p => ({ ...p, per_person: !p.per_person }))}
                    className="h-4 w-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500" />
                  <span className="text-sm text-gray-700">Per Person</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={suppFormData.vat_applicable}
                    onChange={() => setSuppFormData(p => ({ ...p, vat_applicable: !p.vat_applicable }))}
                    className="h-4 w-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500" />
                  <span className="text-sm text-gray-700">VAT Applicable</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={suppFormData.is_active}
                    onChange={() => setSuppFormData(p => ({ ...p, is_active: !p.is_active }))}
                    className="h-4 w-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500" />
                  <span className="text-sm text-gray-700">Active</span>
                </label>
              </div>
            </div>

            {/* Footer */}
            <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-gray-100">
              <button onClick={() => setShowSuppModal(false)}
                className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
                Cancel
              </button>
              <button onClick={handleSaveSupplement} disabled={isSaving}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 disabled:opacity-50 transition-colors">
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {editingSupplement ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Supplement Delete Confirm ────────────────────────────────────── */}
      {showSuppDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full p-6 text-center">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-3" />
            <h3 className="text-lg font-bold text-gray-900 mb-2">Delete Supplement?</h3>
            <p className="text-sm text-gray-500 mb-5">This action cannot be undone.</p>
            <div className="flex justify-center gap-2">
              <button onClick={() => setShowSuppDeleteConfirm(null)}
                className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">
                Cancel
              </button>
              <button onClick={() => handleDeleteSupplement(showSuppDeleteConfirm)}
                className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700">
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Toast ───────────────────────────────────────────────────────── */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg text-sm font-medium animate-slide-in ${
          toast.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
        }`}>
          {toast.type === 'success' ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          {toast.message}
        </div>
      )}
    </div>
  );
};
