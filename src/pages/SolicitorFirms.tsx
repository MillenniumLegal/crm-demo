import React, { useState, useEffect, useRef } from 'react';
import { Plus, Edit2, Trash2, Save, X, Building2, Users, CheckCircle, AlertCircle, MapPin, Phone, Mail, TrendingUp, Upload, Globe, Shield, Image as ImageIcon, GitCompareArrows, Star } from 'lucide-react';
import { supabase } from '@/lib/supabase';

type FirmType = 'crm' | 'comparison' | 'both';

const COMPARISON_SITES = [
  { id: 'themoveexchange', label: 'The Move Exchange' },
  { id: 'cheapconveyancing', label: 'Cheap Conveyancing' },
  { id: 'compareconveyancingprices', label: 'Compare Conveyancing Prices' },
];

interface OperatingHoursDay {
  open: string;
  close: string;
}

interface OperatingHours {
  mon: OperatingHoursDay | null;
  tue: OperatingHoursDay | null;
  wed: OperatingHoursDay | null;
  thu: OperatingHoursDay | null;
  fri: OperatingHoursDay | null;
  sat: OperatingHoursDay | null;
  sun: OperatingHoursDay | null;
}

const DEFAULT_OPERATING_HOURS: OperatingHours = {
  mon: { open: '09:00', close: '17:00' },
  tue: { open: '09:00', close: '17:00' },
  wed: { open: '09:00', close: '17:00' },
  thu: { open: '09:00', close: '17:00' },
  fri: { open: '09:00', close: '17:00' },
  sat: null,
  sun: null,
};

const DAY_LABELS: Record<string, string> = {
  mon: 'Monday', tue: 'Tuesday', wed: 'Wednesday', thu: 'Thursday',
  fri: 'Friday', sat: 'Saturday', sun: 'Sunday',
};

interface SolicitorFirm {
  id: string;
  name: string;
  address: string;
  city: string;
  postcode: string;
  phone: string;
  email: string;
  contactPerson?: string;
  dailyCapacityLimit?: number;
  dailyCapacityUsed?: number;
  commissionRate?: number;
  isActive: boolean;
  notes?: string;
  firmType: FirmType;
  logoUrl?: string;
  slug?: string;
  description?: string;
  websiteUrl?: string;
  sraNumber?: string;
  rating?: number | null;
  sortOrder?: number;
  operatingHours?: OperatingHours;
  is24_7?: boolean;
  isPaused?: boolean;
  pauseReason?: string;
  pausedAt?: string;
  pausedUntil?: string;
  acceptedTransactionTypes?: string[];
  siteIds?: string[];
  createdAt: string;
  updatedAt: string;
  webhookUrl?: string | null;
  webhookTestUrl?: string | null;
}

export const SolicitorFirms: React.FC = () => {
  const [firms, setFirms] = useState<SolicitorFirm[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingFirm, setEditingFirm] = useState<SolicitorFirm | null>(null);
  const [formData, setFormData] = useState<Partial<SolicitorFirm>>({
    name: '',
    address: '',
    city: '',
    postcode: '',
    phone: '',
    email: '',
    contactPerson: '',
    dailyCapacityLimit: 5,
    commissionRate: 0,
    isActive: true,
    notes: '',
    firmType: 'crm',
    logoUrl: '',
    slug: '',
    description: '',
    websiteUrl: '',
    sraNumber: '',
    rating: null,
    sortOrder: 0,
    operatingHours: DEFAULT_OPERATING_HOURS,
    is24_7: false,
    isPaused: false,
    pauseReason: '',
    pausedUntil: '',
    acceptedTransactionTypes: [],
    siteIds: [],
    webhookUrl: '',
    webhookTestUrl: '',
  });
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const [filterType, setFilterType] = useState<FirmType | 'all'>('all');
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);
  const [firmToDelete, setFirmToDelete] = useState<string | null>(null);
  const [showValidationModal, setShowValidationModal] = useState(false);
  const [validationMessage, setValidationMessage] = useState('');
  const [lastAction, setLastAction] = useState<'create' | 'update' | 'delete' | null>(null);
  const [dailyLeadCounts, setDailyLeadCounts] = useState<Record<string, number>>({});
  const [dailyAppearanceCounts, setDailyAppearanceCounts] = useState<Record<string, number>>({});
  const [selectedFirmIds, setSelectedFirmIds] = useState<string[]>([]);

  // Load solicitor firms from Supabase
  useEffect(() => {
    loadFirms();
    loadDailyLeadCounts();
    loadDailyAppearanceCounts();
  }, []);

  const loadFirms = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('solicitor_firms')
        .select('*')
        .order('name', { ascending: true });

      if (error) {
        console.error('Error loading solicitor firms:', error);
        // Use fallback data if table doesn't exist yet
        setFirms(getDefaultFirms());
      } else if (data) {
        // Transform database fields to frontend format
        const transformedData = data.map((firm: any) => ({
          ...firm,
          address: firm.address || '',
          city: firm.city || '',
          postcode: firm.postcode || '',
          contactPerson: firm.contact_person || firm.contactPerson,
          dailyCapacityLimit: firm.daily_capacity_limit || 5,
          dailyCapacityUsed: firm.daily_capacity_used || 0,
          commissionRate: firm.commission_rate || firm.commissionRate,
          isActive: firm.is_active !== undefined ? firm.is_active : firm.isActive,
          firmType: firm.firm_type || 'crm',
          logoUrl: firm.logo_url || '',
          slug: firm.slug || '',
          description: firm.description || '',
          websiteUrl: firm.website_url || '',
          sraNumber: firm.sra_number || '',
          rating: firm.rating ?? null,
          sortOrder: firm.sort_order || 0,
          operatingHours: firm.operating_hours || DEFAULT_OPERATING_HOURS,
          is24_7: firm.is_24_7 || false,
          isPaused: firm.is_paused || false,
          pauseReason: firm.pause_reason || '',
          pausedAt: firm.paused_at || '',
          pausedUntil: firm.paused_until || '',
          acceptedTransactionTypes: firm.accepted_transaction_types || [],
          siteIds: firm.site_ids || [],
          createdAt: firm.created_at || firm.createdAt,
          updatedAt: firm.updated_at || firm.updatedAt,
          webhookUrl: firm.webhook_url || null,
          webhookTestUrl: firm.webhook_test_url || null,
        }));
        setFirms(transformedData);
      }
    } catch (err) {
      console.error('Error:', err);
      setFirms(getDefaultFirms());
    } finally {
      setIsLoading(false);
    }
  };

  const loadDailyLeadCounts = async () => {
    try {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const { data, error } = await supabase
        .from('comparison_leads')
        .select('selected_firm_id')
        .gte('created_at', todayStart.toISOString());

      if (error || !data) return;

      const counts: Record<string, number> = {};
      for (const row of data) {
        const fid = row.selected_firm_id;
        if (fid) counts[fid] = (counts[fid] || 0) + 1;
      }
      setDailyLeadCounts(counts);
    } catch {
      // comparison_leads table may not exist yet
    }
  };

  const loadDailyAppearanceCounts = async () => {
    try {
      const { data, error } = await supabase.rpc('count_today_appearances_by_firm');
      if (!error && data) {
        const counts: Record<string, number> = {};
        for (const row of data as Array<{ firm_id: string; appearance_count: number }>) {
          if (row.firm_id) counts[row.firm_id] = Number(row.appearance_count || 0);
        }
        setDailyAppearanceCounts(counts);
        return;
      }
    } catch {
      // Fallback below.
    }

    try {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const { data: rows, error: fallbackErr } = await supabase
        .from('comparison_leads')
        .select('quote_breakdown')
        .gte('created_at', todayStart.toISOString());

      if (fallbackErr || !rows) return;

      const counts: Record<string, number> = {};
      for (const row of rows) {
        const breakdown = row.quote_breakdown as any;
        const displayed = Array.isArray(breakdown?.displayedFirms) ? breakdown.displayedFirms : [];
        for (const df of displayed) {
          const fid = typeof df?.firmId === 'string' ? df.firmId : '';
          if (fid) counts[fid] = (counts[fid] || 0) + 1;
        }
      }
      setDailyAppearanceCounts(counts);
    } catch {
      // Ignore; UI will just show zero appearances.
    }
  };

  // Default solicitor firms for fallback
  const getDefaultFirms = (): SolicitorFirm[] => {
    return [
        {
        id: '1',
        name: 'Smith & Partners Solicitors',
        address: '123 High Street',
        city: 'London',
        postcode: 'SW1A 1AA',
        phone: '020 7123 4567',
        email: 'info@smithpartners.co.uk',
        contactPerson: 'John Smith',
        dailyCapacityLimit: 5,
        dailyCapacityUsed: 2,
        commissionRate: 5.5,
        isActive: true,
        notes: 'Primary partner for residential conveyancing',
        firmType: 'both' as FirmType,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: '2',
        name: 'Davies Legal Services',
        address: '456 Market Street',
        city: 'Manchester',
        postcode: 'M1 1AA',
        phone: '0161 234 5678',
        email: 'contact@davieslegal.co.uk',
        contactPerson: 'Sarah Davies',
        dailyCapacityLimit: 8,
        dailyCapacityUsed: 5,
        commissionRate: 6.0,
        isActive: true,
        notes: 'Excellent for commercial properties',
        firmType: 'comparison' as FirmType,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: '3',
        name: 'Thompson & Associates',
        address: '789 Victoria Road',
        city: 'Birmingham',
        postcode: 'B1 1AA',
        phone: '0121 345 6789',
        email: 'info@thompsonassociates.co.uk',
        contactPerson: 'Michael Thompson',
        dailyCapacityLimit: 5,
        dailyCapacityUsed: 5,
        commissionRate: 5.0,
        isActive: true,
        notes: 'Specialists in remortgages',
        firmType: 'crm' as FirmType,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: '4',
        name: 'Wilson Legal Group',
        address: '321 Park Lane',
        city: 'Leeds',
        postcode: 'LS1 1AA',
        phone: '0113 456 7890',
        email: 'enquiries@wilsonlegal.co.uk',
        contactPerson: 'Emma Wilson',
        dailyCapacityLimit: 5,
        dailyCapacityUsed: 0,
        commissionRate: 5.75,
        isActive: false,
        notes: 'Currently inactive',
        firmType: 'crm' as FirmType,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];
  };

  const handleAddNew = () => {
    setEditingFirm(null);
    setFormData({
      name: '',
      address: '',
      city: '',
      postcode: '',
      phone: '',
      email: '',
      contactPerson: '',
      dailyCapacityLimit: 5,
      commissionRate: 0,
      isActive: true,
      notes: '',
      firmType: 'crm',
      logoUrl: '',
      slug: '',
      description: '',
      websiteUrl: '',
      sraNumber: '',
      rating: null,
      sortOrder: 0,
      operatingHours: DEFAULT_OPERATING_HOURS,
      is24_7: false,
      isPaused: false,
      pauseReason: '',
      pausedUntil: '',
      webhookUrl: '',
      webhookTestUrl: '',
    });
    setLogoFile(null);
    setLogoPreview(null);
    setShowModal(true);
  };

  const handleEdit = (firm: SolicitorFirm) => {
    setEditingFirm(firm);
    setFormData({
      ...firm,
      contactPerson: firm.contactPerson || '',
      dailyCapacityLimit: firm.dailyCapacityLimit || 5,
      commissionRate: firm.commissionRate || 0,
      firmType: firm.firmType || 'crm',
    });
    setLogoFile(null);
    setLogoPreview(firm.logoUrl || null);
    setShowModal(true);
  };

  const handleLogoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      setErrorMessage('Logo file must be under 2MB');
      setShowErrorModal(true);
      return;
    }
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
  };

  const uploadLogo = async (firmId: string): Promise<string | null> => {
    if (!logoFile) return formData.logoUrl || null;
    setUploadingLogo(true);
    try {
      const ext = logoFile.name.split('.').pop()?.toLowerCase() || 'png';
      const path = `${firmId}/logo.${ext}`;
      const { error } = await supabase.storage
        .from('firm-logos')
        .upload(path, logoFile, { upsert: true, contentType: logoFile.type });
      if (error) {
        console.error('Logo upload error:', error);
        return formData.logoUrl || null;
      }
      const { data: urlData } = supabase.storage.from('firm-logos').getPublicUrl(path);
      return urlData?.publicUrl || null;
    } catch (err) {
      console.error('Logo upload failed:', err);
      return formData.logoUrl || null;
    } finally {
      setUploadingLogo(false);
    }
  };

  const generateSlug = (name: string) => {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  };

  const handleSave = async () => {
    try {
      if (!formData.name || !formData.email || !formData.phone) {
        setValidationMessage('Please fill in all required fields (Name, Email, and Phone)');
        setShowValidationModal(true);
        return;
      }

      const dataToSave: any = {
        name: formData.name || '',
        email: formData.email || '',
        phone: formData.phone || null,
        address: formData.address || null,
        city: formData.city || null,
        postcode: formData.postcode || null,
        contact_person: formData.contactPerson || null,
        daily_capacity_limit: formData.dailyCapacityLimit || 5,
        commission_rate: formData.commissionRate ? parseFloat(formData.commissionRate.toString()) : null,
        is_active: formData.isActive !== undefined ? formData.isActive : true,
        notes: formData.notes || null,
        firm_type: formData.firmType || 'crm',
        slug: formData.slug || generateSlug(formData.name || ''),
        description: formData.description || null,
        website_url: formData.websiteUrl || null,
        sra_number: formData.sraNumber || null,
        rating: formData.rating != null ? formData.rating : null,
        sort_order: formData.sortOrder || 0,
        operating_hours: formData.operatingHours || DEFAULT_OPERATING_HOURS,
        is_24_7: formData.is24_7 || false,
        is_paused: formData.isPaused || false,
        pause_reason: formData.isPaused ? (formData.pauseReason || null) : null,
        paused_at: formData.isPaused ? (formData.pausedAt || new Date().toISOString()) : null,
        paused_until: formData.isPaused && formData.pausedUntil ? formData.pausedUntil : null,
        accepted_transaction_types: formData.acceptedTransactionTypes || [],
        site_ids: formData.siteIds || [],
        webhook_url: formData.webhookUrl || null,
        webhook_test_url: formData.webhookTestUrl || null,
      };

      // Clean up dataToSave - remove undefined/empty values and ensure proper types
      const optionalNullFields = ['phone', 'address', 'city', 'postcode', 'contact_person', 'commission_rate', 'notes', 'logo_url', 'slug', 'description', 'website_url', 'sra_number', 'pause_reason', 'paused_at', 'paused_until', 'webhook_url', 'webhook_test_url'];
      Object.keys(dataToSave).forEach(key => {
        if (dataToSave[key] === undefined || dataToSave[key] === '') {
          if (optionalNullFields.includes(key)) {
            dataToSave[key] = null;
          } else {
            delete dataToSave[key];
          }
        }
      });

      // Remove created_at/updated_at for insert (they have defaults) and for update (only update updated_at)
      const { created_at, updated_at, ...dataWithoutTimestamps } = dataToSave;

      let savedFirmId = editingFirm?.id;

      if (editingFirm) {
        // Update existing - only include updated_at
        const updateData = {
          ...dataWithoutTimestamps,
          updated_at: new Date().toISOString(),
        };
        
        const { error } = await supabase
          .from('solicitor_firms')
          .update(updateData)
          .eq('id', editingFirm.id);

        if (error) {
          if (error.code === 'PGRST116' || error.message?.includes('relation') || error.message?.includes('does not exist')) {
            setErrorMessage('The solicitor_firms table does not exist in your database. Please run the migration to create it.');
          } else {
            setErrorMessage(error.message || 'Failed to update solicitor firm. Please try again.');
          }
          setShowErrorModal(true);
          return;
        }
      } else {
        // Create new - don't include created_at or updated_at (they have database defaults)
        const { data: insertedData, error } = await supabase
          .from('solicitor_firms')
          .insert([dataWithoutTimestamps])
          .select('id')
          .single();

        if (error) {
          if (error.code === 'PGRST116' || error.message?.includes('relation') || error.message?.includes('does not exist')) {
            setErrorMessage('The solicitor_firms table does not exist in your database. Please run the migration to create it.');
          } else {
            setErrorMessage(error.message || 'Failed to create solicitor firm. Please try again.');
          }
          setShowErrorModal(true);
          return;
        }
        savedFirmId = insertedData?.id;
      }

      // Upload logo if a file was selected
      if (logoFile && savedFirmId) {
        const logoUrl = await uploadLogo(savedFirmId);
        if (logoUrl) {
          await supabase.from('solicitor_firms').update({ logo_url: logoUrl }).eq('id', savedFirmId);
        }
      }

      await loadFirms();
      setShowModal(false);
      setLastAction(editingFirm ? 'update' : 'create');
      setShowSuccessModal(true);
    } catch (err: any) {
      console.error('Error saving solicitor firm:', err);
      setErrorMessage(err?.message || 'An unexpected error occurred. Please try again.');
      setShowErrorModal(true);
    }
  };

  const handleDeleteClick = (id: string) => {
    setFirmToDelete(id);
    setShowDeleteConfirmModal(true);
  };

  const handleDeleteConfirm = async () => {
    if (!firmToDelete) return;

    try {
      const { error } = await supabase
        .from('solicitor_firms')
        .delete()
        .eq('id', firmToDelete);

      if (error) {
        // Check if it's a table not found error
        if (error.code === 'PGRST116' || error.message?.includes('relation') || error.message?.includes('does not exist')) {
          setErrorMessage('The solicitor_firms table does not exist in your database. Please run the migration to create it.');
        } else {
          setErrorMessage(error.message || 'Failed to delete solicitor firm. Please try again.');
        }
        setShowErrorModal(true);
        setShowDeleteConfirmModal(false);
        setFirmToDelete(null);
        return;
      }

      await loadFirms();
      setShowDeleteConfirmModal(false);
      setFirmToDelete(null);
      setLastAction('delete');
      setShowSuccessModal(true);
    } catch (err: any) {
      console.error('Error deleting solicitor firm:', err);
      setErrorMessage(err?.message || 'An unexpected error occurred. Please try again.');
      setShowErrorModal(true);
      setShowDeleteConfirmModal(false);
      setFirmToDelete(null);
    }
  };

  const handleBatchSetInactive = async () => {
    if (selectedFirmIds.length === 0) return;
    const shouldProceed = window.confirm(`Set ${selectedFirmIds.length} selected firm(s) to inactive?`);
    if (!shouldProceed) return;

    try {
      const { error } = await supabase
        .from('solicitor_firms')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .in('id', selectedFirmIds);

      if (error) {
        setErrorMessage(error.message || 'Failed to set firms inactive. Please try again.');
        setShowErrorModal(true);
        return;
      }

      await loadFirms();
      setSelectedFirmIds([]);
      setLastAction('update');
      setShowSuccessModal(true);
    } catch (err: any) {
      console.error('Error setting firms inactive:', err);
      setErrorMessage(err?.message || 'An unexpected error occurred. Please try again.');
      setShowErrorModal(true);
    }
  };

  const getCapacityStatus = (used: number, limit: number) => {
    if (limit === 0) return { color: 'text-gray-600 bg-gray-50', label: 'No Limit' };
    const percentage = (used / limit) * 100;
    if (percentage >= 100) return { color: 'text-red-600 bg-red-50', label: 'Full' };
    if (percentage >= 80) return { color: 'text-yellow-600 bg-yellow-50', label: 'High' };
    if (percentage >= 50) return { color: 'text-blue-600 bg-blue-50', label: 'Medium' };
    return { color: 'text-green-600 bg-green-50', label: 'Available' };
  };

  const totalStats = {
    totalFirms: firms.length,
    activeFirms: firms.filter(f => f.isActive).length,
    totalDailyQuota: firms.reduce((sum, f) => sum + (f.dailyCapacityLimit || 0), 0),
    dailyUsed: firms.reduce((sum, f) => sum + (f.dailyCapacityUsed || 0), 0),
    dailyAvailable: firms.reduce((sum, f) => sum + Math.max(0, (f.dailyCapacityLimit || 0) - (f.dailyCapacityUsed || 0)), 0),
    displayedToday: firms.reduce((sum, f) => sum + (dailyAppearanceCounts[f.id] || 0), 0),
  };

  const visibleFirms = firms.filter(f => filterType === 'all' || f.firmType === filterType);
  const visibleActiveFirmIds = visibleFirms.filter((f) => f.isActive).map((f) => f.id);
  const allVisibleActiveSelected = visibleActiveFirmIds.length > 0 && visibleActiveFirmIds.every((id) => selectedFirmIds.includes(id));

  useEffect(() => {
    setSelectedFirmIds((prev) => prev.filter((id) => firms.some((f) => f.id === id && f.isActive)));
  }, [firms]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Solicitor Firms</h1>
          <p className="text-gray-600">
            Manage partner solicitor firms and their capacity
          </p>
        </div>
        <button
          onClick={handleAddNew}
          className="btn-primary flex items-center gap-2"
        >
          <Plus className="h-5 w-5" />
          Add Firm
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
        <div className="card">
          <div className="flex items-center">
            <div className="p-3 rounded-lg bg-blue-500">
              <Building2 className="h-6 w-6 text-white" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Firms</p>
              <p className="text-2xl font-bold text-gray-900">{totalStats.totalFirms}</p>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center">
            <div className="p-3 rounded-lg bg-green-500">
              <CheckCircle className="h-6 w-6 text-white" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Active</p>
              <p className="text-2xl font-bold text-gray-900">{totalStats.activeFirms}</p>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center">
            <div className="p-3 rounded-lg bg-purple-500">
              <Users className="h-6 w-6 text-white" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Daily Quota</p>
              <p className="text-2xl font-bold text-gray-900">{totalStats.totalDailyQuota}</p>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center">
            <div className="p-3 rounded-lg bg-yellow-500">
              <TrendingUp className="h-6 w-6 text-white" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Used Today</p>
              <p className="text-2xl font-bold text-gray-900">{totalStats.dailyUsed}</p>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center">
            <div className="p-3 rounded-lg bg-teal-500">
              <AlertCircle className="h-6 w-6 text-white" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Available Today</p>
              <p className="text-2xl font-bold text-gray-900">{totalStats.dailyAvailable}</p>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center">
            <div className="p-3 rounded-lg bg-indigo-500">
              <Globe className="h-6 w-6 text-white" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Shown Today</p>
              <p className="text-2xl font-bold text-gray-900">{totalStats.displayedToday}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="card text-center py-12">
          <p className="text-gray-600">Loading solicitor firms...</p>
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm font-medium text-gray-600 mr-2">Filter:</span>
        {([
          { value: 'all', label: 'All Firms' },
          { value: 'crm', label: 'CRM Only' },
          { value: 'comparison', label: 'Comparison Engine' },
          { value: 'both', label: 'Both' },
        ] as { value: FirmType | 'all'; label: string }[]).map((tab) => (
          <button
            key={tab.value}
            onClick={() => setFilterType(tab.value)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              filterType === tab.value
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {tab.label}
            <span className="ml-1 opacity-70">
              ({tab.value === 'all' ? firms.length : firms.filter(f => f.firmType === tab.value).length})
            </span>
          </button>
        ))}
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <label className="inline-flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={allVisibleActiveSelected}
            onChange={(e) => {
              setSelectedFirmIds((prev) => {
                const next = new Set(prev);
                if (e.target.checked) {
                  visibleActiveFirmIds.forEach((id) => next.add(id));
                } else {
                  visibleActiveFirmIds.forEach((id) => next.delete(id));
                }
                return Array.from(next);
              });
            }}
            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          Select all active in current filter
        </label>
        <button
          onClick={handleBatchSetInactive}
          disabled={selectedFirmIds.length === 0}
          className="px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-800 text-white hover:bg-gray-900 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Set selected inactive ({selectedFirmIds.length})
        </button>
      </div>

      {/* Firms Grid */}
      {!isLoading && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {visibleFirms.map((firm) => {
            const used = firm.dailyCapacityUsed || 0;
            const limit = firm.dailyCapacityLimit || 0;
            const capacityStatus = getCapacityStatus(used, limit);
            const capacityPercentage = limit > 0 ? (used / limit) * 100 : 0;

            return (
              <div key={firm.id} className="card hover:shadow-lg transition-shadow">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={selectedFirmIds.includes(firm.id)}
                      disabled={!firm.isActive}
                      onChange={(e) => {
                        setSelectedFirmIds((prev) =>
                          e.target.checked
                            ? [...new Set([...prev, firm.id])]
                            : prev.filter((id) => id !== firm.id)
                        );
                      }}
                      className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 disabled:opacity-50"
                      aria-label={`Select ${firm.name}`}
                    />
                    {firm.logoUrl ? (
                      <img src={firm.logoUrl} alt={firm.name} className="w-10 h-10 rounded-lg object-contain border border-gray-200 bg-white" />
                    ) : (
                    <div className={`p-2 rounded-lg ${firm.isActive ? 'bg-blue-100' : 'bg-gray-100'}`}>
                      <Building2 className={`h-5 w-5 ${firm.isActive ? 'text-blue-600' : 'text-gray-400'}`} />
                    </div>
                    )}
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">{firm.name}</h3>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span
                          className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                          firm.isActive
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {firm.isActive ? 'Active' : 'Inactive'}
                      </span>
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                            firm.firmType === 'comparison'
                              ? 'bg-purple-100 text-purple-800'
                              : firm.firmType === 'both'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-gray-100 text-gray-700'
                          }`}
                        >
                          {firm.firmType === 'crm' ? 'CRM' : firm.firmType === 'comparison' ? 'Comparison' : 'CRM + Comparison'}
                        </span>
                        {firm.isPaused && (
                          <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                            Paused{firm.pauseReason ? `: ${firm.pauseReason}` : ''}
                          </span>
                        )}
                        {firm.is24_7 && (
                          <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
                            24/7
                          </span>
                        )}
                        {firm.sraNumber && (
                          <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700">
                            SRA: {firm.sraNumber}
                          </span>
                        )}
                        {firm.rating != null && firm.rating > 0 && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-50 text-yellow-700">
                            <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" /> {firm.rating}/5
                          </span>
                        )}
                        {(firm.firmType === 'comparison' || firm.firmType === 'both') && (dailyLeadCounts[firm.id] || 0) > 0 && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                            <GitCompareArrows className="w-3 h-3" />
                            {dailyLeadCounts[firm.id]} today
                          </span>
                        )}
                        {(firm.firmType === 'comparison' || firm.firmType === 'both') && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
                            <Globe className="w-3 h-3" />
                            shown {dailyAppearanceCounts[firm.id] || 0}x today
                          </span>
                        )}
                      </div>
                      {firm.acceptedTransactionTypes && firm.acceptedTransactionTypes.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {firm.acceptedTransactionTypes.map(tt => (
                            <span key={tt} className="px-1.5 py-0.5 text-[10px] rounded bg-indigo-50 text-indigo-600 font-medium">
                              {tt}
                            </span>
                          ))}
                        </div>
                      )}
                      {firm.siteIds && firm.siteIds.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {firm.siteIds.map(sid => {
                            const site = COMPARISON_SITES.find(s => s.id === sid);
                            return (
                              <span key={sid} className="px-1.5 py-0.5 text-[10px] rounded bg-blue-50 text-blue-600 font-medium">
                                {site?.label || sid}
                              </span>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleEdit(firm)}
                      className="text-blue-600 hover:text-blue-900"
                    >
                      <Edit2 className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteClick(firm.id)}
                      className="text-red-600 hover:text-red-900"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-start gap-2 text-sm text-gray-600">
                    <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    <span>{firm.address}, {firm.city}, {firm.postcode}</span>
                  </div>
                  
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Phone className="h-4 w-4 flex-shrink-0" />
                    <span>{firm.phone}</span>
                  </div>
                  
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Mail className="h-4 w-4 flex-shrink-0" />
                    <span>{firm.email}</span>
                  </div>

                  {firm.webhookUrl && (
                    <div className="flex items-start gap-2 text-xs text-gray-500 mt-1">
                      <Globe className="h-3 w-3 flex-shrink-0 mt-0.5" />
                      <span className="break-all">
                        Webhook: {firm.webhookUrl}
                      </span>
                    </div>
                  )}

                  {firm.contactPerson && (
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Users className="h-4 w-4 flex-shrink-0" />
                      <span>Contact: {firm.contactPerson}</span>
                    </div>
                  )}

                  {/* Capacity Bar */}
                  <div className="pt-3 border-t border-gray-200">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-700">Daily Quota</span>
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${capacityStatus.color}`}>
                          {capacityStatus.label}
                        </span>
                        <span className="text-sm text-gray-600">
                          {used} / {limit > 0 ? limit : '∞'}
                        </span>
                      </div>
                    </div>
                    {limit > 0 && (
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full transition-all ${
                            capacityPercentage >= 100
                              ? 'bg-red-500'
                              : capacityPercentage >= 80
                              ? 'bg-yellow-500'
                              : 'bg-green-500'
                          }`}
                          style={{ width: `${Math.min(capacityPercentage, 100)}%` }}
                        />
                      </div>
                    )}
                  </div>

                  {firm.commissionRate && (
                    <div className="flex items-center justify-between text-sm pt-2">
                      <span className="text-gray-600">Commission Rate:</span>
                      <span className="font-medium text-gray-900">{firm.commissionRate}%</span>
                    </div>
                  )}

                  {firm.notes && (
                    <div className="pt-2 text-sm text-gray-600 italic">
                      {firm.notes}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Capacity utilisation leaderboard */}
      {!isLoading && (() => {
        const utilisationRows = firms
          .map((firm) => {
            const cap = firm.dailyCapacityLimit || 0;
            const won = dailyLeadCounts[firm.id] || 0;
            const fillRate = cap > 0 ? won / cap : 0;
            return { id: firm.id, name: firm.name, cap, won, fillRate };
          })
          .filter((r) => r.cap > 0)
          .sort((a, b) => b.fillRate - a.fillRate);

        if (utilisationRows.length === 0) return null;

        return (
          <div className="card">
            <div className="mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Capacity utilisation</h3>
              <p className="text-sm text-gray-600">
                Firms ranked by today's fill rate (leads won vs daily quota)
              </p>
            </div>
            <div className="space-y-3">
              {utilisationRows.map((r) => {
                const widthPct = Math.min(100, r.fillRate * 100);
                const atOrOverCap = r.fillRate >= 1;
                return (
                  <div key={r.id} className="flex items-center gap-3">
                    <span className="w-44 flex-shrink-0 truncate text-sm font-medium text-gray-700" title={r.name}>
                      {r.name}
                    </span>
                    <div className="flex-1 bg-gray-100 rounded-full h-2.5 overflow-hidden">
                      <div
                        className="h-2.5 rounded-full transition-all"
                        style={{
                          width: `${widthPct}%`,
                          backgroundColor: atOrOverCap ? '#ef4444' : '#1e3a8a',
                        }}
                      />
                    </div>
                    <span className="w-14 flex-shrink-0 text-right text-sm tabular-nums text-gray-600">
                      {r.won}/{r.cap}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* Appearance to win */}
      {!isLoading && (() => {
        const conversionRows = firms
          .map((firm) => {
            const shown = dailyAppearanceCounts[firm.id] || 0;
            const won = dailyLeadCounts[firm.id] || 0;
            const winRate = shown > 0 ? won / shown : 0;
            return { id: firm.id, name: firm.name, shown, won, winRate };
          })
          .filter((r) => r.shown > 0)
          .sort((a, b) => b.winRate - a.winRate);

        if (conversionRows.length === 0) return null;

        const totalShown = conversionRows.reduce((sum, r) => sum + r.shown, 0);
        const totalWon = conversionRows.reduce((sum, r) => sum + r.won, 0);
        const overallRate = totalShown > 0 ? Math.round((totalWon / totalShown) * 100) : 0;

        return (
          <div className="card">
            <div className="mb-4 flex items-start justify-between gap-3 flex-wrap">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Appearance to win</h3>
                <p className="text-sm text-gray-600">
                  Today's conversion per firm (leads won vs times shown on comparison results)
                </p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-gray-900 tabular-nums">{overallRate}%</p>
                <p className="text-xs text-gray-500">{totalWon} won / {totalShown} shown overall</p>
              </div>
            </div>
            <div className="space-y-3">
              {conversionRows.map((r) => {
                const ratePct = Math.round(r.winRate * 100);
                const widthPct = Math.min(100, r.winRate * 100);
                return (
                  <div key={r.id} className="flex items-center gap-3">
                    <span className="w-44 flex-shrink-0 truncate text-sm font-medium text-gray-700" title={r.name}>
                      {r.name}
                    </span>
                    <div className="flex-1 bg-gray-100 rounded-full h-2.5 overflow-hidden">
                      <div
                        className="h-2.5 rounded-full transition-all"
                        style={{
                          width: `${widthPct}%`,
                          backgroundColor: r.winRate >= 0.5 ? '#16a34a' : '#1e3a8a',
                        }}
                      />
                    </div>
                    <span className="w-12 flex-shrink-0 text-right text-sm font-semibold tabular-nums text-gray-900">
                      {ratePct}%
                    </span>
                    <span className="w-16 flex-shrink-0 text-right text-xs tabular-nums text-gray-500">
                      {r.won}/{r.shown}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      {!isLoading && firms.length === 0 && (
        <div className="card text-center py-12">
          <Building2 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600">No solicitor firms found</p>
          <p className="text-sm text-gray-500 mt-2">
            Add your first solicitor firm to get started
          </p>
        </div>
      )}

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">
                  {editingFirm ? 'Edit Solicitor Firm' : 'Add New Solicitor Firm'}
                </h3>
                <button
                  onClick={() => setShowModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Firm Name + Type */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Firm Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    className="input"
                    placeholder="Smith & Partners Solicitors"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value, slug: generateSlug(e.target.value) })
                    }
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Firm Type <span className="text-red-500">*</span>
                  </label>
                  <select
                    className="input"
                    value={formData.firmType || 'crm'}
                    onChange={(e) => setFormData({ ...formData, firmType: e.target.value as FirmType })}
                  >
                    <option value="crm">CRM Only (Internal)</option>
                    <option value="comparison">Comparison Engine Only</option>
                    <option value="both">Both (CRM + Comparison)</option>
                  </select>
                  <p className="text-xs text-gray-500 mt-1">
                    {formData.firmType === 'crm' ? 'Used only for internal Millennium instructions' 
                     : formData.firmType === 'comparison' ? 'Shown on comparison site for lead selling'
                     : 'Used in both internal workflow and comparison site'}
                  </p>
                </div>

                {/* Logo upload */}
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Firm Logo</label>
                  <div className="flex items-center gap-4">
                    {logoPreview ? (
                      <img src={logoPreview} alt="Logo preview" className="w-16 h-16 rounded-lg object-contain border border-gray-200 bg-gray-50" />
                    ) : (
                      <div className="w-16 h-16 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center bg-gray-50">
                        <ImageIcon className="w-6 h-6 text-gray-400" />
                      </div>
                    )}
                    <div className="flex-1">
                      <input
                        ref={logoInputRef}
                        type="file"
                        accept="image/png,image/jpeg,image/svg+xml,image/webp"
                        onChange={handleLogoSelect}
                        className="hidden"
                      />
                      <button
                        type="button"
                        onClick={() => logoInputRef.current?.click()}
                        className="btn-secondary text-sm flex items-center gap-2"
                      >
                        <Upload className="w-4 h-4" />
                        {logoPreview ? 'Change Logo' : 'Upload Logo'}
                      </button>
                      <p className="text-xs text-gray-500 mt-1">PNG, JPG, SVG, or WebP. Max 2MB.</p>
                    </div>
                    <div className="flex-1">
                      <label className="block text-xs text-gray-500 mb-1">Or paste URL</label>
                      <input
                        type="url"
                        className="input text-sm"
                        placeholder="https://example.com/logo.png"
                        value={formData.logoUrl || ''}
                        onChange={(e) => {
                          setFormData({ ...formData, logoUrl: e.target.value });
                          if (e.target.value) {
                            setLogoPreview(e.target.value);
                            setLogoFile(null);
                          }
                        }}
                      />
                    </div>
                  </div>
                </div>

                {/* Description - only for comparison/both firms */}
                {(formData.firmType === 'comparison' || formData.firmType === 'both') && (
                  <>
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                      <textarea
                        className="input"
                        rows={2}
                        placeholder="Award-winning conveyancing firm with 20+ years experience..."
                        value={formData.description || ''}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      />
                      <p className="text-xs text-gray-500 mt-1">Shown on the comparison results page</p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        <Globe className="w-3.5 h-3.5 inline mr-1" />Website URL
                      </label>
                      <input type="url" className="input" placeholder="https://www.firm.co.uk"
                        value={formData.websiteUrl || ''}
                        onChange={(e) => setFormData({ ...formData, websiteUrl: e.target.value })} />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        <Shield className="w-3.5 h-3.5 inline mr-1" />SRA Number
                      </label>
                      <input type="text" className="input" placeholder="e.g. 123456"
                        value={formData.sraNumber || ''}
                        onChange={(e) => setFormData({ ...formData, sraNumber: e.target.value })} />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        <Star className="w-3.5 h-3.5 inline mr-1" />Firm Rating
                      </label>
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1">
                          {[1, 2, 3, 4, 5].map(star => {
                            const val = formData.rating ?? 0;
                            const full = val >= star;
                            const half = !full && val >= star - 0.5;
                            return (
                              <button
                                key={star}
                                type="button"
                                onClick={() => setFormData({ ...formData, rating: formData.rating === star ? null : star })}
                                className="p-0.5 transition-colors"
                              >
                                <Star className={`w-6 h-6 ${full ? 'text-yellow-400 fill-yellow-400' : half ? 'text-yellow-400 fill-yellow-200' : 'text-gray-300'}`} />
                              </button>
                            );
                          })}
                        </div>
                        <input
                          type="number"
                          min="0"
                          max="5"
                          step="0.1"
                          className="input w-20 text-sm py-1.5 text-center"
                          placeholder="e.g. 4.7"
                          value={formData.rating ?? ''}
                          onChange={(e) => {
                            const v = e.target.value;
                            if (v === '') { setFormData({ ...formData, rating: null }); return; }
                            const n = parseFloat(v);
                            if (!isNaN(n) && n >= 0 && n <= 5) setFormData({ ...formData, rating: Math.round(n * 10) / 10 });
                          }}
                        />
                        {formData.rating != null && (
                          <span className="text-sm text-gray-500">{formData.rating}/5</span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 mt-1">Enter a decimal rating (e.g. 4.7) or click stars. Displayed on comparison results.</p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Sort Order</label>
                      <input type="number" min="0" className="input" placeholder="0"
                        value={formData.sortOrder || 0}
                        onChange={(e) => setFormData({ ...formData, sortOrder: parseInt(e.target.value) || 0 })} />
                      <p className="text-xs text-gray-500 mt-1">Lower numbers display first</p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">URL Slug</label>
                      <input type="text" className="input" placeholder="smith-partners"
                        value={formData.slug || ''}
                        onChange={(e) => setFormData({ ...formData, slug: e.target.value })} />
                      <p className="text-xs text-gray-500 mt-1">Auto-generated from name</p>
                    </div>
                  </>
                )}

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Address
                  </label>
                  <input
                    type="text"
                    className="input"
                    placeholder="123 High Street"
                    value={formData.address}
                    onChange={(e) =>
                      setFormData({ ...formData, address: e.target.value })
                    }
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    City
                  </label>
                  <input
                    type="text"
                    className="input"
                    placeholder="London"
                    value={formData.city}
                    onChange={(e) =>
                      setFormData({ ...formData, city: e.target.value })
                    }
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Postcode
                  </label>
                  <input
                    type="text"
                    className="input"
                    placeholder="SW1A 1AA"
                    value={formData.postcode}
                    onChange={(e) =>
                      setFormData({ ...formData, postcode: e.target.value })
                    }
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Phone <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="tel"
                    className="input"
                    placeholder="020 7123 4567"
                    value={formData.phone}
                    onChange={(e) =>
                      setFormData({ ...formData, phone: e.target.value })
                    }
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    className="input"
                    placeholder="info@firm.co.uk"
                    value={formData.email}
                    onChange={(e) =>
                      setFormData({ ...formData, email: e.target.value })
                    }
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Lead Webhook URL
                  </label>
                  <input
                    type="url"
                    className="input"
                    placeholder="https://example.com/webhook/lead"
                    value={formData.webhookUrl || ''}
                    onChange={(e) => setFormData({ ...formData, webhookUrl: e.target.value })}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Optional. If set, we will POST a standard JSON payload here whenever this firm receives a new comparison lead, callback request, or instruction.
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Test Webhook URL (optional)
                  </label>
                  <input
                    type="url"
                    className="input"
                    placeholder="https://example.com/webhook-test/lead"
                    value={formData.webhookTestUrl || ''}
                    onChange={(e) => setFormData({ ...formData, webhookTestUrl: e.target.value })}
                  />
                  <button
                    type="button"
                    disabled={!(formData.webhookTestUrl || formData.webhookUrl)}
                    onClick={() => {
                      const url = (formData.webhookTestUrl || formData.webhookUrl || '').trim();
                      if (!url) return;
                      const payload = {
                        event: 'test_webhook',
                        test: true,
                        timestamp: new Date().toISOString(),
                        firmName: formData.name || '',
                        sampleEvent: 'new_lead',
                        firm: {
                          id: '00000000-0000-0000-0000-000000000000',
                          name: formData.name || 'Example Legal Ltd',
                          email: formData.email || 'leads@example-legal.co.uk',
                        },
                        lead: {
                          id: '11111111-1111-1111-1111-111111111111',
                          firstName: 'Test',
                          lastName: 'Customer',
                          email: 'test.customer@example.com',
                          phone: '+447700900123',
                          transactionType: 'Purchase',
                          propertyPostcode: 'SW1A 1AA',
                          propertyValue: 250000,
                          propertyType: 'Freehold',
                          propertyRegion: 'England',
                        },
                        quote: {
                          totalIncVat: 840,
                          legalFeeExVat: 575,
                          legalFeeIncVat: 690,
                          supplements: [
                            { name: 'Mortgage Admin Fee', fee: 70 },
                          ],
                          disbursements: [
                            { name: 'OS1', fee: 3 },
                            { name: 'Office Copy Entries', fee: 11 },
                          ],
                          sdlt: 0,
                          landRegistryFee: 20,
                        },
                        source: {
                          siteId: 'themoveexchange',
                          referrer: 'https://themove-exchange.co.uk/test-webhook',
                          utmSource: 'google',
                          utmMedium: 'cpc',
                          utmCampaign: 'test-webhook-campaign',
                        },
                      };
                      fetch(url, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload),
                      }).catch(() => {
                        // Integrator can inspect their own logs; we do not surface network errors here.
                      });
                      alert('Test webhook sent. Please check your webhook receiver (e.g. n8n) to map the fields.');
                    }}
                    className="mt-2 inline-flex items-center px-3 py-1.5 rounded-md text-xs font-medium border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Send Test Webhook
                  </button>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Contact Person
                  </label>
                  <input
                    type="text"
                    className="input"
                    placeholder="John Smith"
                    value={formData.contactPerson}
                    onChange={(e) =>
                      setFormData({ ...formData, contactPerson: e.target.value })
                    }
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Daily Quota <span className="text-gray-500 text-xs">(instructions per day)</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    className="input"
                    placeholder="5"
                    value={formData.dailyCapacityLimit || ''}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        dailyCapacityLimit: parseInt(e.target.value) || 5,
                      })
                    }
                  />
                  <p className="text-xs text-gray-500 mt-1">Maximum number of leads this firm can receive per day. 0 = unlimited.</p>
                </div>

                {/* Accepted Lead Types */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Accepted Lead Types
                  </label>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {['Purchase', 'Sale', 'Sale & Purchase', 'Remortgage', 'Transfer of Equity'].map(tt => {
                      const selected = (formData.acceptedTransactionTypes || []).includes(tt);
                      return (
                        <button key={tt} type="button"
                          onClick={() => {
                            const current = formData.acceptedTransactionTypes || [];
                            setFormData({
                              ...formData,
                              acceptedTransactionTypes: selected
                                ? current.filter(t => t !== tt)
                                : [...current, tt],
                            });
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
                  <p className="text-xs text-gray-500 mt-1">Leave empty to accept all lead types. Select specific types to limit which leads this firm receives.</p>
                </div>

                {/* Sites */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Comparison Sites
                  </label>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {COMPARISON_SITES.map(site => {
                      const selected = (formData.siteIds || []).includes(site.id);
                      return (
                        <button key={site.id} type="button"
                          onClick={() => {
                            const current = formData.siteIds || [];
                            setFormData({
                              ...formData,
                              siteIds: selected
                                ? current.filter(s => s !== site.id)
                                : [...current, site.id],
                            });
                          }}
                          className={`px-2.5 py-1 text-xs rounded-lg border transition-colors ${
                            selected
                              ? 'bg-blue-50 border-blue-300 text-blue-700'
                              : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'
                          }`}
                        >
                          {site.label}
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">Leave empty to show on all sites. Select specific sites to restrict where this firm appears.</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Commission Rate (%)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    className="input"
                    placeholder="5.5"
                    value={formData.commissionRate}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        commissionRate: parseFloat(e.target.value) || 0,
                      })
                    }
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Status
                  </label>
                  <select
                    className="input"
                    value={formData.isActive ? 'true' : 'false'}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        isActive: e.target.value === 'true',
                      })
                    }
                  >
                    <option value="true">Active</option>
                    <option value="false">Inactive</option>
                  </select>
                </div>

                {/* ─── Operating Hours & Pause ─── */}
                <div className="md:col-span-2 border-t border-gray-100 pt-4 mt-2">
                  <h3 className="text-sm font-semibold text-gray-800 mb-3">Operating Hours & Lead Controls</h3>

                  {/* 24/7 toggle */}
                  <label className="flex items-center gap-2 cursor-pointer mb-3">
                    <input type="checkbox" checked={formData.is24_7 || false}
                      onChange={() => setFormData({ ...formData, is24_7: !formData.is24_7 })}
                      className="h-4 w-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500" />
                    <span className="text-sm text-gray-700">Available 24/7</span>
                  </label>

                  {!formData.is24_7 && (
                    <div className="space-y-2 mb-4">
                      {(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const).map((day) => {
                        const hours = formData.operatingHours?.[day];
                        const isOpen = hours !== null && hours !== undefined;
                        return (
                          <div key={day} className="flex items-center gap-2">
                            <label className="flex items-center gap-1.5 w-24">
                              <input type="checkbox" checked={isOpen}
                                onChange={() => {
                                  const updated = { ...(formData.operatingHours || DEFAULT_OPERATING_HOURS) };
                                  (updated as any)[day] = isOpen ? null : { open: '09:00', close: '17:00' };
                                  setFormData({ ...formData, operatingHours: updated });
                                }}
                                className="h-3.5 w-3.5 rounded border-gray-300 text-purple-600 focus:ring-purple-500" />
                              <span className="text-xs text-gray-700">{DAY_LABELS[day]}</span>
                            </label>
                            {isOpen && (
                              <div className="flex items-center gap-1 text-xs">
                                <input type="time" value={hours.open}
                                  onChange={(e) => {
                                    const updated = { ...(formData.operatingHours || DEFAULT_OPERATING_HOURS) };
                                    (updated as any)[day] = { ...hours, open: e.target.value };
                                    setFormData({ ...formData, operatingHours: updated });
                                  }}
                                  className="border border-gray-200 rounded px-1.5 py-1 text-xs focus:ring-1 focus:ring-purple-500 outline-none" />
                                <span className="text-gray-400">to</span>
                                <input type="time" value={hours.close}
                                  onChange={(e) => {
                                    const updated = { ...(formData.operatingHours || DEFAULT_OPERATING_HOURS) };
                                    (updated as any)[day] = { ...hours, close: e.target.value };
                                    setFormData({ ...formData, operatingHours: updated });
                                  }}
                                  className="border border-gray-200 rounded px-1.5 py-1 text-xs focus:ring-1 focus:ring-purple-500 outline-none" />
                              </div>
                            )}
                            {!isOpen && <span className="text-xs text-gray-400">Closed</span>}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Pause controls */}
                  <div className="border-t border-gray-100 pt-3 mt-3">
                    <label className="flex items-center gap-2 cursor-pointer mb-2">
                      <input type="checkbox" checked={formData.isPaused || false}
                        onChange={() => setFormData({ ...formData, isPaused: !formData.isPaused })}
                        className="h-4 w-4 rounded border-gray-300 text-red-600 focus:ring-red-500" />
                      <span className="text-sm text-gray-700 font-medium">Pause Lead Receiving</span>
                    </label>

                    {formData.isPaused && (
                      <div className="ml-6 space-y-2">
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Reason</label>
                          <select value={formData.pauseReason || ''}
                            onChange={(e) => setFormData({ ...formData, pauseReason: e.target.value })}
                            className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:ring-1 focus:ring-purple-500 outline-none">
                            <option value="">Select reason...</option>
                            <option value="Invoice unpaid">Invoice unpaid</option>
                            <option value="At capacity">At capacity</option>
                            <option value="Holiday / Leave">Holiday / Leave</option>
                            <option value="Technical issue">Technical issue</option>
                            <option value="Other">Other</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Resume Date (optional)</label>
                          <input type="datetime-local"
                            value={formData.pausedUntil ? formData.pausedUntil.slice(0, 16) : ''}
                            onChange={(e) => setFormData({ ...formData, pausedUntil: e.target.value ? new Date(e.target.value).toISOString() : '' })}
                            className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:ring-1 focus:ring-purple-500 outline-none" />
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Notes
                  </label>
                  <textarea
                    className="input"
                    rows={3}
                    placeholder="Additional notes about this firm..."
                    value={formData.notes}
                    onChange={(e) =>
                      setFormData({ ...formData, notes: e.target.value })
                    }
                  />
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={() => setShowModal(false)}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button onClick={handleSave} disabled={uploadingLogo} className="btn-primary flex items-center gap-2 disabled:opacity-60">
                {uploadingLogo ? (
                  <><span className="animate-spin">⏳</span> Uploading Logo...</>
                ) : (
                  <><Save className="h-4 w-4" /> {editingFirm ? 'Update' : 'Create'}</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Success Modal */}
      {showSuccessModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="flex items-center gap-4 mb-4">
              <div className="p-2 rounded-full bg-green-100">
                <CheckCircle className="h-6 w-6 text-green-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900">Success</h3>
            </div>
            <p className="text-gray-600 mb-6">
              {lastAction === 'update' 
                ? 'Solicitor firm updated successfully!' 
                : lastAction === 'delete'
                ? 'Solicitor firm deleted successfully!'
                : 'Solicitor firm created successfully!'}
            </p>
            <div className="flex justify-end">
              <button
                onClick={() => setShowSuccessModal(false)}
                className="btn-primary"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Error Modal */}
      {showErrorModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="flex items-center gap-4 mb-4">
              <div className="p-2 rounded-full bg-red-100">
                <AlertCircle className="h-6 w-6 text-red-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900">Error</h3>
            </div>
            <p className="text-gray-600 mb-6">
              {errorMessage}
            </p>
            <div className="flex justify-end">
              <button
                onClick={() => setShowErrorModal(false)}
                className="btn-primary"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Validation Modal */}
      {showValidationModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="flex items-center gap-4 mb-4">
              <div className="p-2 rounded-full bg-yellow-100">
                <AlertCircle className="h-6 w-6 text-yellow-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900">Validation Error</h3>
            </div>
            <p className="text-gray-600 mb-6">
              {validationMessage}
            </p>
            <div className="flex justify-end">
              <button
                onClick={() => setShowValidationModal(false)}
                className="btn-primary"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirmModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="flex items-center gap-4 mb-4">
              <div className="p-2 rounded-full bg-red-100">
                <AlertCircle className="h-6 w-6 text-red-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900">Confirm Delete</h3>
            </div>
            <p className="text-gray-600 mb-6">
              Are you sure you want to delete this solicitor firm? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowDeleteConfirmModal(false);
                  setFirmToDelete(null);
                }}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteConfirm}
                className="btn-primary bg-red-600 hover:bg-red-700"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

