'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Layout } from '@/components/layout/Layout';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { locationsApi } from '@/lib/api/locations';
import { Location, REGIONS } from '@/lib/types';
import { format } from 'date-fns';
import { Plus, ChevronDown, ChevronRight, Edit, Trash2, MapPin } from 'lucide-react';

export default function LocationsPage() {
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedRegions, setExpandedRegions] = useState<Set<string>>(new Set());
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingLocation, setEditingLocation] = useState<Location | null>(null);
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    region: 'Greater Accra',
    description: '',
    is_active: true,
  });

  // Group locations by region
  const locationsByRegion = useMemo(() => {
    console.log('=== GROUPING LOCATIONS BY REGION ===');
    console.log(`Total locations to group: ${locations.length}`);
    console.log('Available REGIONS:', REGIONS);
    
    const grouped: Record<string, Location[]> = {};
    REGIONS.forEach(region => {
      grouped[region] = [];
    });
    // Also track locations with unknown regions
    const unknownRegion: Location[] = [];
    
    locations.forEach((location, idx) => {
      console.log(`[${idx + 1}] Processing location:`, {
        id: location.id,
        name: location.name,
        region: location.region,
        regionType: typeof location.region,
      });
      
      if (location.region) {
        // Try to find exact match first
        if (grouped[location.region]) {
          console.log(`  ✓ Exact match found for region: "${location.region}"`);
          grouped[location.region].push(location);
        } else {
          // Try case-insensitive match
          const regionStr = String(location.region).toLowerCase();
          const matchedRegion = REGIONS.find(r => r.toLowerCase() === regionStr);
          if (matchedRegion) {
            console.log(`  ✓ Case-insensitive match: "${regionStr}" -> "${matchedRegion}"`);
            grouped[matchedRegion].push(location);
          } else {
            // Location has a region that's not in our REGIONS list
            console.warn(`  ✗ Location "${location.name}" has unknown region: "${location.region}"`);
            console.warn(`    Available regions:`, REGIONS);
            unknownRegion.push(location);
          }
        }
      } else {
        console.warn(`  ✗ Location "${location.name}" has no region`);
        unknownRegion.push(location);
      }
    });
    
    // Add unknown region locations to the first region or create a special group
    if (unknownRegion.length > 0) {
      console.warn(`Found ${unknownRegion.length} locations without valid regions:`, unknownRegion.map(l => ({ id: l.id, name: l.name, region: l.region })));
      // Add them to "Greater Accra" as default, or you could create a separate section
      grouped['Greater Accra'] = [...grouped['Greater Accra'], ...unknownRegion];
    }
    
    // Log final grouping
    console.log('=== FINAL GROUPING RESULTS ===');
    Object.keys(grouped).forEach(region => {
      console.log(`${region}: ${grouped[region].length} locations`);
      if (grouped[region].length > 0) {
        grouped[region].forEach(loc => {
          console.log(`  - ${loc.name} (ID: ${loc.id}, Region: ${loc.region})`);
        });
      }
    });
    
    return grouped;
  }, [locations]);

  useEffect(() => {
    fetchLocations();
  }, []);

  const fetchLocations = async () => {
    setLoading(true);
    setError(null);
    try {
      console.log('Fetching locations...');
      const data = await locationsApi.list();
      console.log('Locations fetched successfully:', data);
      console.log(`Total locations received: ${data.length}`);
      setLocations(Array.isArray(data) ? data : []);
      
      // Log region distribution
      const regionCounts: Record<string, number> = {};
      data.forEach(loc => {
        const region = loc.region || 'Unknown';
        regionCounts[region] = (regionCounts[region] || 0) + 1;
      });
      console.log('Locations by region:', regionCounts);
    } catch (error: any) {
      console.error('Error fetching locations:', error);
      console.error('Error response:', error?.response);
      const errorMessage = error?.response?.data?.detail || error?.response?.data?.message || error?.message || 'Failed to fetch locations';
      setError(errorMessage);
      setLocations([]);
    } finally {
      setLoading(false);
    }
  };

  const toggleRegion = (region: string) => {
    const newExpanded = new Set(expandedRegions);
    if (newExpanded.has(region)) {
      newExpanded.delete(region);
    } else {
      newExpanded.add(region);
    }
    setExpandedRegions(newExpanded);
  };

  const handleCreate = (region?: string) => {
    setEditingLocation(null);
    setSelectedRegion(region || null);
    setFormData({
      name: '',
      region: region || 'Greater Accra',
      description: '',
      is_active: true,
    });
    setIsModalOpen(true);
  };

  const handleEdit = (location: Location) => {
    setEditingLocation(location);
    setSelectedRegion(null);
    setFormData({
      name: location.name,
      region: location.region ?? 'Greater Accra',
      description: (location as any).description || '',
      is_active: location.is_active ?? true,
    });
    setIsModalOpen(true);
  };

  const handleDelete = async (location: Location) => {
    if (!window.confirm(`Are you sure you want to delete "${location.name}"?`)) {
      return;
    }
    try {
      await locationsApi.delete(location.id);
      fetchLocations();
    } catch (error) {
      console.error('Error deleting location:', error);
      window.alert('Failed to delete location');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Submitting form data:', formData);
    try {
      if (editingLocation) {
        await locationsApi.update(editingLocation.id, formData);
      } else {
        await locationsApi.create(formData);
      }
      setIsModalOpen(false);
      fetchLocations();
    } catch (error: any) {
      console.error('Error saving location:', error);
      const errorMessage = error?.response?.data?.detail || error?.response?.data?.region?.[0] || error?.message || 'Failed to save location';
      window.alert(errorMessage);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-500">Loading locations...</div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Locations</h1>
            {!error && (
              <p className="text-sm text-gray-600 mt-1">
                Total: {locations.length} location{locations.length !== 1 ? 's' : ''}
              </p>
            )}
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={fetchLocations}
              disabled={loading}
            >
              {loading ? 'Refreshing...' : 'Refresh'}
            </Button>
            <Button onClick={() => handleCreate()}>
              <Plus className="h-4 w-4 mr-2" />
              Add Location
            </Button>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-start">
              <div className="flex-1">
                <h3 className="text-sm font-medium text-red-800">Error Loading Locations</h3>
                <p className="mt-1 text-sm text-red-700">{error}</p>
                <button
                  onClick={fetchLocations}
                  className="mt-2 text-sm text-red-600 hover:text-red-800 underline"
                >
                  Try again
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="bg-white rounded-lg shadow">
          {locations.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              No locations found. Create your first location to get started.
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {REGIONS.map((region) => {
                const isExpanded = expandedRegions.has(region);
                const regionLocations = locationsByRegion[region] || [];

                return (
                  <div key={region} className="p-4 hover:bg-gray-50 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center flex-1">
                        <button
                          onClick={() => toggleRegion(region)}
                          className="mr-3 p-1 hover:bg-gray-200 rounded"
                        >
                          {isExpanded ? (
                            <ChevronDown className="h-5 w-5 text-gray-600" />
                          ) : (
                            <ChevronRight className="h-5 w-5 text-gray-600" />
                          )}
                        </button>
                        <div className="flex items-center gap-2 flex-1">
                          <MapPin className="h-5 w-5 text-gray-400" />
                          <div>
                            <h3 className="text-lg font-semibold text-gray-900">{region}</h3>
                            <div className="flex items-center gap-4 mt-1 text-xs text-gray-500">
                              <span>{regionLocations.length} location{regionLocations.length !== 1 ? 's' : ''}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleCreate(region)}
                        >
                          <Plus className="h-4 w-4 mr-1" />
                          Add Location
                        </Button>
                      </div>
                    </div>
                    {isExpanded && (
                      <div className="mt-4 ml-8 space-y-3">
                        {regionLocations.length === 0 ? (
                          <div className="text-sm text-gray-500 py-4 text-center border-2 border-dashed border-gray-200 rounded-lg">
                            No locations in this region. Click &quot;Add Location&quot; to create one.
                          </div>
                        ) : (
                          regionLocations.map((location) => (
                            <div
                              key={location.id}
                              className="p-4 bg-white rounded-lg border border-gray-200 hover:border-gray-300 hover:shadow-sm transition-all"
                            >
                              <div className="flex items-start justify-between">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2">
                                    <h4 className="font-medium text-gray-900">{location.name}</h4>
                                    <span className={`px-2 py-0.5 rounded text-xs ${
                                      location.is_active
                                        ? 'bg-green-100 text-green-800'
                                        : 'bg-red-100 text-red-800'
                                    }`}>
                                      {location.is_active ? 'Active' : 'Inactive'}
                                    </span>
                                  </div>
                                  {(location as any).description && (
                                    <p className="text-sm text-gray-600 mt-1">{(location as any).description}</p>
                                  )}
                                  <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                                    {location.created_at && (
                                      <span>Created {format(new Date(location.created_at), 'MMM dd, yyyy')}</span>
                                    )}
                                    {location.updated_at && location.updated_at !== location.created_at && (
                                      <span>Updated {format(new Date(location.updated_at), 'MMM dd, yyyy')}</span>
                                    )}
                                  </div>
                                </div>
                                <div className="flex items-center gap-1 ml-4">
                                  <button
                                    onClick={() => handleEdit(location)}
                                    className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                    title="Edit location"
                                  >
                                    <Edit className="h-4 w-4" />
                                  </button>
                                  <button
                                    onClick={() => handleDelete(location)}
                                    className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                                    title="Delete location"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </button>
                                </div>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <Modal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          title={editingLocation ? 'Edit Location' : 'Create Location'}
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Name"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            />
            <Select
              label="Region"
              required
              value={formData.region}
              onChange={(e) => {
                const selectedRegion = e.target.value;
                console.log('Region selected:', selectedRegion);
                setFormData({ ...formData, region: selectedRegion });
              }}
              options={REGIONS.map(r => ({ value: r, label: r }))}
            />
            <Textarea
              label="Description"
              rows={4}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            />
            <div className="flex items-center">
              <input
                type="checkbox"
                id="is_active"
                checked={formData.is_active}
                onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
              />
              <label htmlFor="is_active" className="ml-2 block text-sm text-gray-900">
                Active
              </label>
            </div>
            <div className="flex justify-end space-x-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsModalOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit">Save</Button>
            </div>
          </form>
        </Modal>
      </div>
    </Layout>
  );
}
