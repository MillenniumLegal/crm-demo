import React, { useState } from 'react';
import { Search, Filter, Plus, Eye, Edit, Phone, Mail, MessageSquare } from 'lucide-react';

export const Leads: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLeads, setSelectedLeads] = useState<string[]>([]);

  // Mock data - replace with actual API calls
  const leads: Array<{
    id: string;
    name: string;
    email: string;
    phone: string;
    source: string;
    status: string;
    assignedTo: string;
    lastAction: string;
    quoteAmount: number;
    shortCode?: string;
  }> = [
    {
      id: '1',
      name: 'John Smith',
      email: 'john.smith@email.com',
      phone: '+44 1704 773288',
      source: 'Website',
      status: 'New',
      assignedTo: 'Agent 1',
      lastAction: '2 hours ago',
      quoteAmount: 1200,
    },
    {
      id: '2',
      name: 'Sarah Johnson',
      email: 'sarah.j@email.com',
      phone: '+44 1704 773289',
      source: 'Comparison Site',
      status: 'Contacted',
      assignedTo: 'Agent 2',
      lastAction: '1 day ago',
      quoteAmount: 1500,
    },
    {
      id: '3',
      name: 'Mike Wilson',
      email: 'mike.w@email.com',
      phone: '+44 1704 773290',
      source: 'Direct',
      status: 'Interested',
      assignedTo: 'Agent 1',
      lastAction: '3 hours ago',
      quoteAmount: 1800,
    },
    {
      id: '4',
      name: 'Emma Davis',
      email: 'emma.d@email.com',
      phone: '+44 1704 773291',
      source: 'Website',
      status: 'Quote Sent',
      assignedTo: 'Agent 3',
      lastAction: '5 hours ago',
      quoteAmount: 2000,
    },
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'New': return 'bg-blue-100 text-blue-800';
      case 'Contacted': return 'bg-yellow-100 text-yellow-800';
      case 'Interested': return 'bg-green-100 text-green-800';
      case 'Quote Sent': return 'bg-purple-100 text-purple-800';
      case 'Sold': return 'bg-green-100 text-green-800';
      case 'Closed': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const handleSelectLead = (leadId: string) => {
    setSelectedLeads(prev => 
      prev.includes(leadId) 
        ? prev.filter(id => id !== leadId)
        : [...prev, leadId]
    );
  };

  const handleSelectAll = () => {
    if (selectedLeads.length === leads.length) {
      setSelectedLeads([]);
    } else {
      setSelectedLeads(leads.map(lead => lead.id));
    }
  };

  const filteredLeads = leads.filter(lead =>
    lead.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    lead.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    lead.phone.includes(searchTerm)
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Conveyancing Leads</h1>
          <p className="text-gray-600">Manage and track all your conveyancing leads</p>
        </div>
        <button className="btn-primary flex items-center space-x-2">
          <Plus className="h-5 w-5" />
          <span>Add Lead</span>
        </button>
      </div>

      {/* Filters and Search */}
      <div className="card">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search leads..."
                className="input-field pl-10"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
          <div className="flex gap-2">
            <select className="input-field">
              <option>All Sources</option>
              <option>Hoowla</option>
              <option>Comparison Site</option>
              <option>Direct</option>
            </select>
            <select className="input-field">
              <option>All Status</option>
              <option>New</option>
              <option>Contacted</option>
              <option>Interested</option>
              <option>Quote Sent</option>
            </select>
            <button className="btn-secondary flex items-center space-x-2">
              <Filter className="h-5 w-5" />
              <span>Filter</span>
            </button>
          </div>
        </div>
      </div>

      {/* Bulk Actions */}
      {selectedLeads.length > 0 && (
        <div className="card bg-blue-50 border-blue-200">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-blue-800">
              {selectedLeads.length} lead(s) selected
            </span>
            <div className="flex space-x-2">
              <button className="btn-primary text-sm">Assign</button>
              <button className="btn-secondary text-sm">Export</button>
              <button className="btn-danger text-sm">Archive</button>
            </div>
          </div>
        </div>
      )}

      {/* Leads Table */}
      <div className="card p-0">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="table-header">
                  <input
                    type="checkbox"
                    checked={selectedLeads.length === leads.length}
                    onChange={handleSelectAll}
                    className="rounded border-gray-300 text-navy-600 focus:ring-navy-500"
                  />
                </th>
                <th className="table-header">Name</th>
                <th className="table-header">Contact</th>
                <th className="table-header">Source</th>
                <th className="table-header">Status</th>
                <th className="table-header">Assigned To</th>
                <th className="table-header">Last Action</th>
                <th className="table-header">Quote Amount</th>
                <th className="table-header">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredLeads.map((lead) => (
                <tr key={lead.id} className="hover:bg-gray-50">
                  <td className="table-cell">
                    <input
                      type="checkbox"
                      checked={selectedLeads.includes(lead.id)}
                      onChange={() => handleSelectLead(lead.id)}
                      className="rounded border-gray-300 text-navy-600 focus:ring-navy-500"
                    />
                  </td>
                  <td className="table-cell">
                    <div>
                      <div className="font-medium text-gray-900">{lead.name}</div>
                      <div className="text-sm text-gray-500">ID: {lead.shortCode || lead.id}</div>
                    </div>
                  </td>
                  <td className="table-cell">
                    <div>
                      <div className="text-sm text-gray-900">{lead.email}</div>
                      <div className="text-sm text-gray-500">{lead.phone}</div>
                    </div>
                  </td>
                  <td className="table-cell">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                      {lead.source}
                    </span>
                  </td>
                  <td className="table-cell">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(lead.status)}`}>
                      {lead.status}
                    </span>
                  </td>
                  <td className="table-cell text-sm text-gray-900">
                    {lead.assignedTo}
                  </td>
                  <td className="table-cell text-sm text-gray-500">
                    {lead.lastAction}
                  </td>
                  <td className="table-cell text-sm font-medium text-gray-900">
                    £{lead.quoteAmount?.toLocaleString() || 'N/A'}
                  </td>
                  <td className="table-cell">
                    <div className="flex space-x-2">
                      <button className="text-gray-400 hover:text-gray-600" title="View">
                        <Eye className="h-4 w-4" />
                      </button>
                      <button className="text-gray-400 hover:text-gray-600" title="Edit">
                        <Edit className="h-4 w-4" />
                      </button>
                      <button className="text-gray-400 hover:text-gray-600" title="Call">
                        <Phone className="h-4 w-4" />
                      </button>
                      <button className="text-gray-400 hover:text-gray-600" title="Email">
                        <Mail className="h-4 w-4" />
                      </button>
                      <button className="text-gray-400 hover:text-gray-600" title="SMS">
                        <MessageSquare className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-gray-700">
          Showing <span className="font-medium">1</span> to <span className="font-medium">4</span> of{' '}
          <span className="font-medium">4</span> results
        </div>
        <div className="flex space-x-2">
          <button className="btn-secondary text-sm">Previous</button>
          <button className="btn-primary text-sm">1</button>
          <button className="btn-secondary text-sm">Next</button>
        </div>
      </div>
    </div>
  );
};
