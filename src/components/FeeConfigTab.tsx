import React, { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Loader2, DollarSign, FileText, Percent, Building2 } from 'lucide-react';
import {
  fetchFeeRulesAll,
  fetchLegalFeeBandsAll,
  fetchSdltRatesAll,
  fetchLandRegistryFeesAll,
  createFeeRule,
  updateFeeRule,
  deleteFeeRule,
  createLegalFeeBand,
  updateLegalFeeBand,
  deleteLegalFeeBand,
  createSdltRate,
  updateSdltRate,
  deleteSdltRate,
  createLandRegistryFee,
  updateLandRegistryFee,
  deleteLandRegistryFee,
  type FeeRule,
  type LegalFeeBand,
  type SdltRate,
  type LandRegistryFee
} from '@/services/feeConfigService';

const RULE_KEYS = [
  { value: 'leasehold', label: 'Leasehold' },
  { value: 'mortgaged', label: 'Mortgaged' },
  { value: 'first_time_buyer', label: 'First Time Buyer' },
  { value: 'new_build', label: 'New Build' },
  { value: 'shared_ownership', label: 'Shared Ownership' },
  { value: 'buy_to_let', label: 'Buy to Let or 2nd Home' },
  { value: 'unregistered', label: 'Unregistered' },
  { value: 'help_to_buy_equity_loan', label: 'Help to Buy Equity Loan' },
  { value: 'help_to_buy_isa', label: 'Help-to-Buy ISA' },
  { value: 'right_to_buy', label: 'Right to Buy' },
  { value: 'islamic_mortgage', label: 'Islamic Mortgage' },
  { value: 'auction_repossession', label: 'Auction/Repossession' },
  { value: 'gifted_deposit', label: 'Gifted Deposit' },
  { value: 'non_uk_resident', label: 'Non-UK Resident' },
  { value: 'client_company', label: 'Client is Company' },
  { value: 'company_claiming_relief', label: 'Company is Claiming Relief' },
];

interface FeeConfigTabProps {
  onNotification: (message: string, type: 'success' | 'error') => void;
}

export const FeeConfigTab: React.FC<FeeConfigTabProps> = ({ onNotification }) => {
  const [feeRules, setFeeRules] = useState<FeeRule[]>([]);
  const [legalFeeBands, setLegalFeeBands] = useState<LegalFeeBand[]>([]);
  const [sdltRates, setSdltRates] = useState<SdltRate[]>([]);
  const [landRegistryFees, setLandRegistryFees] = useState<LandRegistryFee[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeSection, setActiveSection] = useState<'rules' | 'bands' | 'sdlt' | 'lr'>('rules');

  const loadAll = async () => {
    setLoading(true);
    try {
      const [rules, bands, sdlt, lr] = await Promise.all([
        fetchFeeRulesAll(),
        fetchLegalFeeBandsAll(),
        fetchSdltRatesAll(),
        fetchLandRegistryFeesAll()
      ]);
      setFeeRules(rules);
      setLegalFeeBands(bands);
      setSdltRates(sdlt);
      setLandRegistryFees(lr);
    } catch (e) {
      console.error(e);
      const msg = (e as any)?.message || 'Failed to load fee configuration.';
      onNotification(msg, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  if (loading) {
    return (
      <div className="card text-center py-12">
        <Loader2 className="h-8 w-8 animate-spin mx-auto text-gray-400 mb-4" />
        <p className="text-gray-600">Loading fee configuration...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Quote / Fee configuration</h2>
        <p className="text-sm text-gray-600 mt-1">
          Configure fee rules, property value bands, SDLT rates, and Land Registry fees. Used for quote auto-calculation (Hoowla-style).
        </p>
      </div>

      {/* Sub-tabs */}
      <div className="flex flex-wrap gap-2 border-b border-gray-200 pb-2">
        {[
          { id: 'rules' as const, label: 'Fee rules', icon: FileText },
          { id: 'bands' as const, label: 'Legal fee bands', icon: DollarSign },
          { id: 'sdlt' as const, label: 'SDLT rates', icon: Percent },
          { id: 'lr' as const, label: 'Land Registry fees', icon: Building2 }
        ].map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveSection(id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium ${
              activeSection === id ? 'bg-[#011E41] text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      {activeSection === 'rules' && (
        <FeeRulesSection
          rules={feeRules}
          onRefresh={loadAll}
          onNotification={onNotification}
          setSaving={setSaving}
        />
      )}
      {activeSection === 'bands' && (
        <LegalFeeBandsSection
          bands={legalFeeBands}
          onRefresh={loadAll}
          onNotification={onNotification}
          setSaving={setSaving}
        />
      )}
      {activeSection === 'sdlt' && (
        <SdltRatesSection
          rates={sdltRates}
          onRefresh={loadAll}
          onNotification={onNotification}
          setSaving={setSaving}
        />
      )}
      {activeSection === 'lr' && (
        <LandRegistryFeesSection
          fees={landRegistryFees}
          onRefresh={loadAll}
          onNotification={onNotification}
          setSaving={setSaving}
        />
      )}

      {saving && (
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <Loader2 className="h-4 w-4 animate-spin" />
          Saving...
        </div>
      )}
    </div>
  );
};

// --- Fee rules section ---
function FeeRulesSection({
  rules,
  onRefresh,
  onNotification,
  setSaving
}: {
  rules: FeeRule[];
  onRefresh: () => void;
  onNotification: (m: string, t: 'success' | 'error') => void;
  setSaving: (v: boolean) => void;
}) {
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<FeeRule | null>(null);
  const [form, setForm] = useState({
    ruleKey: 'leasehold',
    itemType: 'supplement' as 'supplement' | 'disbursement',
    itemName: '',
    amountExVat: 0,
    region: '',
    isActive: true
  });

  const openAdd = () => {
    setEditing(null);
    setForm({ ruleKey: 'leasehold', itemType: 'supplement', itemName: '', amountExVat: 0, region: '', isActive: true });
    setShowModal(true);
  };

  const openEdit = (r: FeeRule) => {
    setEditing(r);
    setForm({
      ruleKey: r.ruleKey,
      itemType: r.itemType,
      itemName: r.itemName,
      amountExVat: r.amountExVat,
      region: r.region || '',
      isActive: r.isActive
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.itemName.trim()) {
      onNotification('Item name is required.', 'error');
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        await updateFeeRule(editing.id, {
          ruleKey: form.ruleKey,
          itemType: form.itemType,
          itemName: form.itemName.trim(),
          amountExVat: form.amountExVat,
          region: form.region.trim() || null,
          isActive: form.isActive
        });
        onNotification('Fee rule updated.', 'success');
      } else {
        await createFeeRule({
          ruleKey: form.ruleKey,
          itemType: form.itemType,
          itemName: form.itemName.trim(),
          amountExVat: form.amountExVat,
          transactionTypes: null,
          region: form.region.trim() || null,
          isActive: form.isActive,
          sortOrder: rules.length
        });
        onNotification('Fee rule added.', 'success');
      }
      setShowModal(false);
      onRefresh();
    } catch (e) {
      onNotification((e as any)?.message || (e instanceof Error ? e.message : 'Failed to save.'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this fee rule?')) return;
    setSaving(true);
    try {
      await deleteFeeRule(id);
      onNotification('Fee rule deleted.', 'success');
      onRefresh();
    } catch (e) {
      onNotification((e as any)?.message || (e instanceof Error ? e.message : 'Failed to delete.'), 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="card">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-md font-semibold text-gray-900">Fee rules (checkbox → supplement/disbursement)</h3>
        <button type="button" className="btn-primary flex items-center gap-2" onClick={openAdd}>
          <Plus className="h-4 w-4" />
          Add rule
        </button>
      </div>
      <p className="text-sm text-gray-600 mb-4">
        When a quote has the condition (e.g. Leasehold), this supplement or disbursement is added automatically.
      </p>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase">Condition</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase">Type</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase">Item name</th>
              <th className="px-4 py-2 text-right text-xs font-medium text-gray-600 uppercase">Amount (Ex VAT)</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase">Region</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase">Active</th>
              <th className="px-4 py-2 text-right text-xs font-medium text-gray-600 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {rules.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-gray-500">
                  No fee rules. Add one to auto-add supplements/disbursements when quote conditions are set.
                </td>
              </tr>
            ) : (
              rules.map((r) => (
                <tr key={r.id}>
                  <td className="px-4 py-2 text-sm text-gray-900">
                    {RULE_KEYS.find((k) => k.value === r.ruleKey)?.label ?? r.ruleKey}
                  </td>
                  <td className="px-4 py-2 text-sm text-gray-700">{r.itemType}</td>
                  <td className="px-4 py-2 text-sm text-gray-900">{r.itemName}</td>
                  <td className="px-4 py-2 text-sm text-right font-medium">£{r.amountExVat.toFixed(2)}</td>
                  <td className="px-4 py-2 text-sm text-gray-600">{r.region || '—'}</td>
                  <td className="px-4 py-2 text-sm">{r.isActive ? 'Yes' : 'No'}</td>
                  <td className="px-4 py-2 text-right">
                    <button type="button" className="text-gray-500 hover:text-gray-700 mr-2" onClick={() => openEdit(r)}>
                      <Edit className="h-4 w-4 inline" />
                    </button>
                    <button type="button" className="text-red-500 hover:text-red-700" onClick={() => handleDelete(r.id)}>
                      <Trash2 className="h-4 w-4 inline" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
            <h4 className="text-lg font-semibold text-gray-900 mb-4">{editing ? 'Edit fee rule' : 'Add fee rule'}</h4>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Condition (rule key)</label>
                <select
                  className="input-field w-full"
                  value={form.ruleKey}
                  onChange={(e) => setForm({ ...form, ruleKey: e.target.value })}
                >
                  {RULE_KEYS.map((k) => (
                    <option key={k.value} value={k.value}>{k.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                <select
                  className="input-field w-full"
                  value={form.itemType}
                  onChange={(e) => setForm({ ...form, itemType: e.target.value as 'supplement' | 'disbursement' })}
                >
                  <option value="supplement">Supplement</option>
                  <option value="disbursement">Disbursement</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Item name *</label>
                <input
                  className="input-field w-full"
                  value={form.itemName}
                  onChange={(e) => setForm({ ...form, itemName: e.target.value })}
                  placeholder="e.g. Leasehold Fee"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Amount (Ex VAT) £</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className="input-field w-full"
                  value={form.amountExVat || ''}
                  onChange={(e) => setForm({ ...form, amountExVat: parseFloat(e.target.value) || 0 })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Region (optional)</label>
                <input
                  className="input-field w-full"
                  value={form.region}
                  onChange={(e) => setForm({ ...form, region: e.target.value })}
                  placeholder="England, Wales, etc."
                />
              </div>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                />
                <span className="text-sm text-gray-700">Active</span>
              </label>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button type="button" className="btn-secondary" onClick={() => setShowModal(false)}>
                Cancel
              </button>
              <button type="button" className="btn-primary" onClick={handleSave}>
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// --- Legal fee bands section ---
function LegalFeeBandsSection({
  bands,
  onRefresh,
  onNotification,
  setSaving
}: {
  bands: LegalFeeBand[];
  onRefresh: () => void;
  onNotification: (m: string, t: 'success' | 'error') => void;
  setSaving: (v: boolean) => void;
}) {
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<LegalFeeBand | null>(null);
  const [form, setForm] = useState({
    minValue: 0,
    maxValue: '' as number | '',
    legalFeeExVat: 0,
    region: '',
    transactionType: '',
    isActive: true
  });

  const openAdd = () => {
    setEditing(null);
    setForm({ minValue: 0, maxValue: '', legalFeeExVat: 0, region: '', transactionType: '', isActive: true });
    setShowModal(true);
  };

  const openEdit = (b: LegalFeeBand) => {
    setEditing(b);
    setForm({
      minValue: b.minValue,
      maxValue: b.maxValue ?? '',
      legalFeeExVat: b.legalFeeExVat,
      region: b.region || '',
      transactionType: b.transactionType || '',
      isActive: b.isActive
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const maxVal = form.maxValue === '' ? null : Number(form.maxValue);
      if (editing) {
        await updateLegalFeeBand(editing.id, {
          minValue: form.minValue,
          maxValue: maxVal,
          legalFeeExVat: form.legalFeeExVat,
          region: form.region.trim() || null,
          transactionType: form.transactionType.trim() || null,
          isActive: form.isActive
        });
        onNotification('Legal fee band updated.', 'success');
      } else {
        await createLegalFeeBand({
          minValue: form.minValue,
          maxValue: maxVal,
          legalFeeExVat: form.legalFeeExVat,
          region: form.region.trim() || null,
          transactionType: form.transactionType.trim() || null,
          isActive: form.isActive,
          sortOrder: bands.length
        });
        onNotification('Legal fee band added.', 'success');
      }
      setShowModal(false);
      onRefresh();
    } catch (e) {
      onNotification((e as any)?.message || (e instanceof Error ? e.message : 'Failed to save.'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this band?')) return;
    setSaving(true);
    try {
      await deleteLegalFeeBand(id);
      onNotification('Band deleted.', 'success');
      onRefresh();
    } catch (e) {
      onNotification((e as any)?.message || (e instanceof Error ? e.message : 'Failed to delete.'), 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="card">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-md font-semibold text-gray-900">Property value bands → Legal fee (Ex VAT)</h3>
        <button type="button" className="btn-primary flex items-center gap-2" onClick={openAdd}>
          <Plus className="h-4 w-4" />
          Add band
        </button>
      </div>
      <p className="text-sm text-gray-600 mb-4">
        When quote property value falls in a band, the base legal fee is set automatically. Band: min_value ≤ value &lt; max_value (empty max = no cap).
      </p>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-right text-xs font-medium text-gray-600 uppercase">Min value (£)</th>
              <th className="px-4 py-2 text-right text-xs font-medium text-gray-600 uppercase">Max value (£)</th>
              <th className="px-4 py-2 text-right text-xs font-medium text-gray-600 uppercase">Legal fee Ex VAT (£)</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase">Region</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase">Transaction</th>
              <th className="px-4 py-2 text-right text-xs font-medium text-gray-600 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {bands.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-gray-500">
                  No bands. Add bands to auto-set legal fee from property value.
                </td>
              </tr>
            ) : (
              bands.map((b) => (
                <tr key={b.id}>
                  <td className="px-4 py-2 text-sm text-right">£{b.minValue.toLocaleString()}</td>
                  <td className="px-4 py-2 text-sm text-right">{b.maxValue != null ? `£${b.maxValue.toLocaleString()}` : '—'}</td>
                  <td className="px-4 py-2 text-sm text-right font-medium">£{b.legalFeeExVat.toFixed(2)}</td>
                  <td className="px-4 py-2 text-sm text-gray-600">{b.region || '—'}</td>
                  <td className="px-4 py-2 text-sm text-gray-600">{b.transactionType || '—'}</td>
                  <td className="px-4 py-2 text-right">
                    <button type="button" className="text-gray-500 hover:text-gray-700 mr-2" onClick={() => openEdit(b)}>
                      <Edit className="h-4 w-4 inline" />
                    </button>
                    <button type="button" className="text-red-500 hover:text-red-700" onClick={() => handleDelete(b.id)}>
                      <Trash2 className="h-4 w-4 inline" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
            <h4 className="text-lg font-semibold text-gray-900 mb-4">{editing ? 'Edit band' : 'Add band'}</h4>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Min value (£)</label>
                <input
                  type="number"
                  min="0"
                  step="1000"
                  className="input-field w-full"
                  value={form.minValue || ''}
                  onChange={(e) => setForm({ ...form, minValue: parseFloat(e.target.value) || 0 })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Max value (£) – leave empty for no cap</label>
                <input
                  type="number"
                  min="0"
                  step="1000"
                  className="input-field w-full"
                  value={form.maxValue === '' ? '' : form.maxValue}
                  onChange={(e) => setForm({ ...form, maxValue: e.target.value === '' ? '' : parseFloat(e.target.value) })}
                  placeholder="e.g. 250000"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Legal fee Ex VAT (£)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className="input-field w-full"
                  value={form.legalFeeExVat || ''}
                  onChange={(e) => setForm({ ...form, legalFeeExVat: parseFloat(e.target.value) || 0 })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Region (optional)</label>
                <input
                  className="input-field w-full"
                  value={form.region}
                  onChange={(e) => setForm({ ...form, region: e.target.value })}
                  placeholder="England"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Transaction type (optional)</label>
                <input
                  className="input-field w-full"
                  value={form.transactionType}
                  onChange={(e) => setForm({ ...form, transactionType: e.target.value })}
                  placeholder="Purchase, Sale, Remortgage"
                />
              </div>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                />
                <span className="text-sm text-gray-700">Active</span>
              </label>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button type="button" className="btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
              <button type="button" className="btn-primary" onClick={handleSave}>Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// --- SDLT rates section ---
function SdltRatesSection({
  rates,
  onRefresh,
  onNotification,
  setSaving
}: {
  rates: SdltRate[];
  onRefresh: () => void;
  onNotification: (m: string, t: 'success' | 'error') => void;
  setSaving: (v: boolean) => void;
}) {
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<SdltRate | null>(null);
  const [form, setForm] = useState({
    versionLabel: 'Standard Rate Apr 2025 and after',
    region: 'England',
    isFirstTimeBuyer: false,
    bandMin: 0,
    bandMax: '' as number | '',
    ratePercent: 0,
    isActive: true
  });

  const openAdd = () => {
    setEditing(null);
    setForm({
      versionLabel: 'Standard Rate Apr 2025 and after',
      region: 'England',
      isFirstTimeBuyer: false,
      bandMin: 0,
      bandMax: '',
      ratePercent: 0,
      isActive: true
    });
    setShowModal(true);
  };

  const openEdit = (r: SdltRate) => {
    setEditing(r);
    setForm({
      versionLabel: r.versionLabel,
      region: r.region,
      isFirstTimeBuyer: r.isFirstTimeBuyer,
      bandMin: r.bandMin,
      bandMax: r.bandMax ?? '',
      ratePercent: r.ratePercent,
      isActive: r.isActive
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const bandMax = form.bandMax === '' ? null : Number(form.bandMax);
      if (editing) {
        await updateSdltRate(editing.id, {
          versionLabel: form.versionLabel,
          region: form.region,
          isFirstTimeBuyer: form.isFirstTimeBuyer,
          bandMin: form.bandMin,
          bandMax,
          ratePercent: form.ratePercent,
          isActive: form.isActive
        });
        onNotification('SDLT rate updated.', 'success');
      } else {
        await createSdltRate({
          versionLabel: form.versionLabel,
          region: form.region,
          isFirstTimeBuyer: form.isFirstTimeBuyer,
          bandMin: form.bandMin,
          bandMax,
          ratePercent: form.ratePercent,
          isActive: form.isActive,
          sortOrder: rates.length
        });
        onNotification('SDLT rate added.', 'success');
      }
      setShowModal(false);
      onRefresh();
    } catch (e) {
      onNotification((e as any)?.message || (e instanceof Error ? e.message : 'Failed to save.'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this SDLT rate band?')) return;
    setSaving(true);
    try {
      await deleteSdltRate(id);
      onNotification('SDLT rate deleted.', 'success');
      onRefresh();
    } catch (e) {
      onNotification((e as any)?.message || (e instanceof Error ? e.message : 'Failed to delete.'), 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="card">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-md font-semibold text-gray-900">SDLT rates (version / region / FTB → band %)</h3>
        <button type="button" className="btn-primary flex items-center gap-2" onClick={openAdd}>
          <Plus className="h-4 w-4" />
          Add rate band
        </button>
      </div>
      <p className="text-sm text-gray-600 mb-4">
        Band min/max (property value) and rate %. Stamp Duty is computed from these bands.
      </p>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase">Version</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase">Region</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase">First-time buyer</th>
              <th className="px-4 py-2 text-right text-xs font-medium text-gray-600 uppercase">Band min (£)</th>
              <th className="px-4 py-2 text-right text-xs font-medium text-gray-600 uppercase">Band max (£)</th>
              <th className="px-4 py-2 text-right text-xs font-medium text-gray-600 uppercase">Rate %</th>
              <th className="px-4 py-2 text-right text-xs font-medium text-gray-600 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {rates.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-gray-500">
                  No SDLT rates. Add bands to auto-calculate Stamp Duty.
                </td>
              </tr>
            ) : (
              rates.map((r) => (
                <tr key={r.id}>
                  <td className="px-4 py-2 text-sm text-gray-900">{r.versionLabel}</td>
                  <td className="px-4 py-2 text-sm text-gray-700">{r.region}</td>
                  <td className="px-4 py-2 text-sm">{r.isFirstTimeBuyer ? 'Yes' : 'No'}</td>
                  <td className="px-4 py-2 text-sm text-right">£{r.bandMin.toLocaleString()}</td>
                  <td className="px-4 py-2 text-sm text-right">{r.bandMax != null ? `£${r.bandMax.toLocaleString()}` : '—'}</td>
                  <td className="px-4 py-2 text-sm text-right font-medium">{r.ratePercent}%</td>
                  <td className="px-4 py-2 text-right">
                    <button type="button" className="text-gray-500 hover:text-gray-700 mr-2" onClick={() => openEdit(r)}>
                      <Edit className="h-4 w-4 inline" />
                    </button>
                    <button type="button" className="text-red-500 hover:text-red-700" onClick={() => handleDelete(r.id)}>
                      <Trash2 className="h-4 w-4 inline" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
            <h4 className="text-lg font-semibold text-gray-900 mb-4">{editing ? 'Edit SDLT rate' : 'Add SDLT rate band'}</h4>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Version label</label>
                <input
                  className="input-field w-full"
                  value={form.versionLabel}
                  onChange={(e) => setForm({ ...form, versionLabel: e.target.value })}
                  placeholder="Standard Rate Apr 2025 and after"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Region</label>
                <select
                  className="input-field w-full"
                  value={form.region}
                  onChange={(e) => setForm({ ...form, region: e.target.value })}
                >
                  <option value="England">England</option>
                  <option value="Wales">Wales</option>
                  <option value="Scotland">Scotland</option>
                  <option value="Northern Ireland">Northern Ireland</option>
                </select>
              </div>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.isFirstTimeBuyer}
                  onChange={(e) => setForm({ ...form, isFirstTimeBuyer: e.target.checked })}
                />
                <span className="text-sm text-gray-700">First-time buyer band</span>
              </label>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Band min (£)</label>
                <input
                  type="number"
                  min="0"
                  step="1000"
                  className="input-field w-full"
                  value={form.bandMin || ''}
                  onChange={(e) => setForm({ ...form, bandMin: parseFloat(e.target.value) || 0 })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Band max (£) – empty = no cap</label>
                <input
                  type="number"
                  min="0"
                  step="1000"
                  className="input-field w-full"
                  value={form.bandMax === '' ? '' : form.bandMax}
                  onChange={(e) => setForm({ ...form, bandMax: e.target.value === '' ? '' : parseFloat(e.target.value) })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Rate %</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  className="input-field w-full"
                  value={form.ratePercent || ''}
                  onChange={(e) => setForm({ ...form, ratePercent: parseFloat(e.target.value) || 0 })}
                />
              </div>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />
                <span className="text-sm text-gray-700">Active</span>
              </label>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button type="button" className="btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
              <button type="button" className="btn-primary" onClick={handleSave}>Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// --- Land Registry fees section ---
function LandRegistryFeesSection({
  fees,
  onRefresh,
  onNotification,
  setSaving
}: {
  fees: LandRegistryFee[];
  onRefresh: () => void;
  onNotification: (m: string, t: 'success' | 'error') => void;
  setSaving: (v: boolean) => void;
}) {
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<LandRegistryFee | null>(null);
  const [form, setForm] = useState({
    versionLabel: '31st Jan 2022 and after',
    minValue: 0,
    maxValue: '' as number | '',
    feeAmount: 0,
    electronicSubmission: false,
    isActive: true
  });

  const openAdd = () => {
    setEditing(null);
    setForm({
      versionLabel: '31st Jan 2022 and after',
      minValue: 0,
      maxValue: '',
      feeAmount: 0,
      electronicSubmission: false,
      isActive: true
    });
    setShowModal(true);
  };

  const openEdit = (f: LandRegistryFee) => {
    setEditing(f);
    setForm({
      versionLabel: f.versionLabel,
      minValue: f.minValue,
      maxValue: f.maxValue ?? '',
      feeAmount: f.feeAmount,
      electronicSubmission: f.electronicSubmission,
      isActive: f.isActive
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const maxVal = form.maxValue === '' ? null : Number(form.maxValue);
      if (editing) {
        await updateLandRegistryFee(editing.id, {
          versionLabel: form.versionLabel,
          minValue: form.minValue,
          maxValue: maxVal,
          feeAmount: form.feeAmount,
          electronicSubmission: form.electronicSubmission,
          isActive: form.isActive
        });
        onNotification('Land Registry fee updated.', 'success');
      } else {
        await createLandRegistryFee({
          versionLabel: form.versionLabel,
          minValue: form.minValue,
          maxValue: maxVal,
          feeAmount: form.feeAmount,
          electronicSubmission: form.electronicSubmission,
          isActive: form.isActive,
          sortOrder: fees.length
        });
        onNotification('Land Registry fee added.', 'success');
      }
      setShowModal(false);
      onRefresh();
    } catch (e) {
      onNotification((e as any)?.message || (e instanceof Error ? e.message : 'Failed to save.'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this Land Registry fee band?')) return;
    setSaving(true);
    try {
      await deleteLandRegistryFee(id);
      onNotification('Land Registry fee deleted.', 'success');
      onRefresh();
    } catch (e) {
      onNotification((e as any)?.message || (e instanceof Error ? e.message : 'Failed to delete.'), 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="card">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-md font-semibold text-gray-900">Land Registry fee bands</h3>
        <button type="button" className="btn-primary flex items-center gap-2" onClick={openAdd}>
          <Plus className="h-4 w-4" />
          Add band
        </button>
      </div>
      <p className="text-sm text-gray-600 mb-4">
        Version + value band + electronic submission → fee amount. Used for quote auto-calculation.
      </p>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase">Version</th>
              <th className="px-4 py-2 text-right text-xs font-medium text-gray-600 uppercase">Min value (£)</th>
              <th className="px-4 py-2 text-right text-xs font-medium text-gray-600 uppercase">Max value (£)</th>
              <th className="px-4 py-2 text-right text-xs font-medium text-gray-600 uppercase">Fee (£)</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase">Electronic</th>
              <th className="px-4 py-2 text-right text-xs font-medium text-gray-600 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {fees.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-gray-500">
                  No Land Registry fee bands. Add bands to auto-calculate Land Registry fees.
                </td>
              </tr>
            ) : (
              fees.map((f) => (
                <tr key={f.id}>
                  <td className="px-4 py-2 text-sm text-gray-900">{f.versionLabel}</td>
                  <td className="px-4 py-2 text-sm text-right">£{f.minValue.toLocaleString()}</td>
                  <td className="px-4 py-2 text-sm text-right">{f.maxValue != null ? `£${f.maxValue.toLocaleString()}` : '—'}</td>
                  <td className="px-4 py-2 text-sm text-right font-medium">£{f.feeAmount.toFixed(2)}</td>
                  <td className="px-4 py-2 text-sm">{f.electronicSubmission ? 'Yes' : 'No'}</td>
                  <td className="px-4 py-2 text-right">
                    <button type="button" className="text-gray-500 hover:text-gray-700 mr-2" onClick={() => openEdit(f)}>
                      <Edit className="h-4 w-4 inline" />
                    </button>
                    <button type="button" className="text-red-500 hover:text-red-700" onClick={() => handleDelete(f.id)}>
                      <Trash2 className="h-4 w-4 inline" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
            <h4 className="text-lg font-semibold text-gray-900 mb-4">{editing ? 'Edit Land Registry fee' : 'Add Land Registry fee band'}</h4>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Version label</label>
                <input
                  className="input-field w-full"
                  value={form.versionLabel}
                  onChange={(e) => setForm({ ...form, versionLabel: e.target.value })}
                  placeholder="31st Jan 2022 and after"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Min value (£)</label>
                <input
                  type="number"
                  min="0"
                  step="1000"
                  className="input-field w-full"
                  value={form.minValue || ''}
                  onChange={(e) => setForm({ ...form, minValue: parseFloat(e.target.value) || 0 })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Max value (£) – empty = no cap</label>
                <input
                  type="number"
                  min="0"
                  step="1000"
                  className="input-field w-full"
                  value={form.maxValue === '' ? '' : form.maxValue}
                  onChange={(e) => setForm({ ...form, maxValue: e.target.value === '' ? '' : parseFloat(e.target.value) })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Fee amount (£)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className="input-field w-full"
                  value={form.feeAmount || ''}
                  onChange={(e) => setForm({ ...form, feeAmount: parseFloat(e.target.value) || 0 })}
                />
              </div>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.electronicSubmission}
                  onChange={(e) => setForm({ ...form, electronicSubmission: e.target.checked })}
                />
                <span className="text-sm text-gray-700">Electronic submission</span>
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />
                <span className="text-sm text-gray-700">Active</span>
              </label>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button type="button" className="btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
              <button type="button" className="btn-primary" onClick={handleSave}>Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
