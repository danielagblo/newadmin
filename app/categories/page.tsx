'use client';

import { Layout } from '@/components/layout/Layout';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { categoriesApi, featuresApi, subCategoriesApi } from '@/lib/api/categories';
import { Category, Feature, SubCategory } from '@/lib/types';
import { format } from 'date-fns';
import { ChevronDown, ChevronRight, Edit, Plus, Trash2, X } from 'lucide-react';
import React, { useEffect, useState } from 'react';

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<Set<number>>(new Set());
  const [expandedSubCategories, setExpandedSubCategories] = useState<Set<number>>(new Set());
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [isSubCategoryModalOpen, setIsSubCategoryModalOpen] = useState(false);
  const [isFeatureModalOpen, setIsFeatureModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [editingSubCategory, setEditingSubCategory] = useState<SubCategory | null>(null);
  const [editingFeature, setEditingFeature] = useState<Feature | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [selectedSubCategoryId, setSelectedSubCategoryId] = useState<number | null>(null);
  const [categoryFormData, setCategoryFormData] = useState({
    name: '',
    description: '',
  });
  const [subCategoryFormData, setSubCategoryFormData] = useState({
    name: '',
    description: '',
    category: 0,
  });
  const [featureFormData, setFeatureFormData] = useState({
    name: '',
    description: '',
    subcategory: 0,
    possible_values: [] as string[],
  });
  const [newValue, setNewValue] = useState('');
  // Map of possible value string -> id on server (if available)
  const [possibleValueIds, setPossibleValueIds] = useState<Record<string, number>>({});

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await categoriesApi.list();
      console.log('Categories fetched:', data);
      const categoriesArray = Array.isArray(data) ? data : [];

      // Check if subcategories are already included in the response
      const hasNestedSubcategories = categoriesArray.some(cat => cat.subcategories && cat.subcategories.length > 0);

      if (!hasNestedSubcategories) {
        console.log('Subcategories not included in categories response, fetching separately...');
        // Fetch all subcategories separately
        try {
          const allSubCategories = await subCategoriesApi.list();
          console.log('All subcategories fetched:', allSubCategories);

          // Map subcategories to their categories
          const categoriesWithSubcategories = categoriesArray.map(category => ({
            ...category,
            subcategories: allSubCategories.filter(sub => sub.category === category.id)
          }));

          // For each subcategory, fetch its features
          const categoriesWithFeatures = await Promise.all(
            categoriesWithSubcategories.map(async (category) => {
              const subcategoriesWithFeatures = await Promise.all(
                (category.subcategories || []).map(async (subcategory) => {
                  try {
                    const features = await featuresApi.list(subcategory.id);
                    // fetch possible values for each feature and attach as `possible_values`
                    const featuresWithValues = await Promise.all(
                      (features || []).map(async (f) => {
                        try {
                          const pv = await featuresApi.listPossibleValues(f.id);
                          const values = pv.map((p: any) => (typeof p === 'string' ? p : p.value || '')).filter(Boolean);
                          return { ...f, possible_values: values };
                        } catch (err) {
                          console.error('Error fetching possible values for feature', f.id, err);
                          return { ...f, possible_values: f.possible_values || [] };
                        }
                      })
                    );

                    return {
                      ...subcategory,
                      features: featuresWithValues || []
                    };
                  } catch (error) {
                    console.error(`Error fetching features for subcategory ${subcategory.id}:`, error);
                    return {
                      ...subcategory,
                      features: []
                    };
                  }
                })
              );
              return {
                ...category,
                subcategories: subcategoriesWithFeatures
              };
            })
          );

          setCategories(categoriesWithFeatures);
          console.log('Categories with subcategories and features:', categoriesWithFeatures);
        } catch (subError: any) {
          console.error('Error fetching subcategories:', subError);
          // If subcategories fetch fails, still set categories without them
          setCategories(categoriesArray);
        }
      } else {
        // Subcategories are already nested, but we still need to fetch features
        console.log('Subcategories included in response, fetching features...');
        const categoriesWithFeatures = await Promise.all(
          categoriesArray.map(async (category) => {
            if (category.subcategories && category.subcategories.length > 0) {
              const subcategoriesWithFeatures = await Promise.all(
                category.subcategories.map(async (subcategory) => {
                  try {
                    const features = await featuresApi.list(subcategory.id);
                    // Attach possible values to each feature
                    const featuresWithValues = await Promise.all(
                      (features || []).map(async (f) => {
                        try {
                          const pv = await featuresApi.listPossibleValues(f.id);
                          const values = pv.map((p: any) => (typeof p === 'string' ? p : p.value || '')).filter(Boolean);
                          return { ...f, possible_values: values };
                        } catch (err) {
                          console.error('Error fetching possible values for feature', f.id, err);
                          return { ...f, possible_values: f.possible_values || [] };
                        }
                      })
                    );

                    return {
                      ...subcategory,
                      features: featuresWithValues || []
                    };
                  } catch (error) {
                    console.error(`Error fetching features for subcategory ${subcategory.id}:`, error);
                    return {
                      ...subcategory,
                      features: subcategory.features || []
                    };
                  }
                })
              );
              return {
                ...category,
                subcategories: subcategoriesWithFeatures
              };
            }
            return category;
          })
        );
        setCategories(categoriesWithFeatures);
      }

      if (categoriesArray.length === 0) {
        console.warn('No categories found. The API might return empty data or the endpoint might not exist.');
      }
    } catch (error: any) {
      console.error('Error fetching categories:', error);
      console.error('Error response:', error?.response);
      console.error('Error status:', error?.response?.status);

      let errorMessage = 'Failed to fetch categories';
      let errorDetails = '';

      if (error?.response?.status === 404) {
        errorMessage = 'Categories endpoint not found (404)';
        errorDetails = `The categories API endpoint does not exist on your Django backend.\n\n` +
          `Expected endpoint: /api-v1/admin/categories/\n\n` +
          `Please check if the endpoint exists in your Django backend.`;
      } else if (error?.response?.status === 401) {
        errorMessage = 'Authentication failed (401)';
        errorDetails = 'Please log out and log in again.';
      } else if (error?.response?.status === 403) {
        errorMessage = 'Access denied (403)';
        errorDetails = 'You may not have permission to view categories.';
      } else if (error?.response?.data) {
        errorMessage = 'API Error';
        errorDetails = error.response.data.detail ||
          error.response.data.error_message ||
          error.response.data.message ||
          JSON.stringify(error.response.data);
      } else if (error?.message) {
        errorMessage = 'Error';
        errorDetails = error.message;
      }

      setError(`${errorMessage}\n\n${errorDetails}`);
      setCategories([]);
    } finally {
      setLoading(false);
    }
  };

  const toggleCategory = (categoryId: number) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(categoryId)) {
      newExpanded.delete(categoryId);
    } else {
      newExpanded.add(categoryId);
    }
    setExpandedCategories(newExpanded);
  };

  const toggleSubCategory = (subCategoryId: number) => {
    const newExpanded = new Set(expandedSubCategories);
    if (newExpanded.has(subCategoryId)) {
      newExpanded.delete(subCategoryId);
    } else {
      newExpanded.add(subCategoryId);
    }
    setExpandedSubCategories(newExpanded);
  };

  const handleCreateCategory = () => {
    setEditingCategory(null);
    setCategoryFormData({ name: '', description: '' });
    setIsCategoryModalOpen(true);
  };

  const handleEditCategory = (category: Category) => {
    setEditingCategory(category);
    setCategoryFormData({
      name: category.name,
      description: category.description || '',
    });
    setIsCategoryModalOpen(true);
  };

  const handleDeleteCategory = async (category: Category) => {
    if (!window.confirm(`Are you sure you want to delete "${category.name}"? This will also delete all its subcategories.`)) {
      return;
    }
    try {
      await categoriesApi.delete(category.id);
      fetchCategories();
    } catch (error) {
      console.error('Error deleting category:', error);
      window.alert('Failed to delete category');
    }
  };

  const handleSubmitCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingCategory) {
        await categoriesApi.update(editingCategory.id, categoryFormData);
      } else {
        await categoriesApi.create(categoryFormData);
      }
      setIsCategoryModalOpen(false);
      fetchCategories();
    } catch (error: any) {
      console.error('Error saving category:', error);
      window.alert(error.response?.data?.detail || 'Failed to save category');
    }
  };

  const handleCreateSubCategory = (categoryId: number) => {
    setEditingSubCategory(null);
    setSelectedCategoryId(categoryId);
    setSubCategoryFormData({
      name: '',
      description: '',
      category: categoryId,
    });
    setIsSubCategoryModalOpen(true);
  };

  const handleEditSubCategory = (subCategory: SubCategory, categoryId: number) => {
    setEditingSubCategory(subCategory);
    setSelectedCategoryId(categoryId);
    setSubCategoryFormData({
      name: subCategory.name,
      description: subCategory.description || '',
      category: categoryId,
    });
    setIsSubCategoryModalOpen(true);
  };

  const handleDeleteSubCategory = async (subCategory: SubCategory) => {
    if (!window.confirm(`Are you sure you want to delete "${subCategory.name}"?`)) {
      return;
    }
    try {
      await subCategoriesApi.delete(subCategory.id);
      fetchCategories();
    } catch (error) {
      console.error('Error deleting subcategory:', error);
      window.alert('Failed to delete subcategory');
    }
  };

  const handleSubmitSubCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingSubCategory) {
        await subCategoriesApi.update(editingSubCategory.id, subCategoryFormData);
      } else {
        await subCategoriesApi.create(subCategoryFormData);
      }
      setIsSubCategoryModalOpen(false);
      fetchCategories();
    } catch (error: any) {
      console.error('Error saving subcategory:', error);
      window.alert(error.response?.data?.detail || 'Failed to save subcategory');
    }
  };

  const handleCreateFeature = (subCategoryId: number) => {
    setEditingFeature(null);
    setSelectedSubCategoryId(subCategoryId);
    setFeatureFormData({
      name: '',
      description: '',
      subcategory: subCategoryId,
      possible_values: [],
    });
    setNewValue('');
    // when creating a new feature we don't yet have persisted possible values
    setIsFeatureModalOpen(true);
  };

  const handleEditFeature = (feature: Feature) => {
    setEditingFeature(feature);
    setSelectedSubCategoryId(feature.subcategory);
    setFeatureFormData({
      name: feature.name,
      description: feature.description || '',
      subcategory: feature.subcategory,
      possible_values: feature.possible_values || [],
    });
    setNewValue('');
    // fetch authoritative possible values from API if available
    (async () => {
      try {
        const pv = await featuresApi.listPossibleValues(feature.id);
        // pv items may be objects { id, feature, value } — map to strings and keep ids
        const values: string[] = [];
        const idMap: Record<string, number> = {};
        pv.forEach((p: any) => {
          if (!p) return;
          if (typeof p === 'string') {
            values.push(p);
          } else {
            const val = p.value || p.name || String(p);
            values.push(val);
            if (p.id) idMap[val] = p.id;
          }
        });
        setFeatureFormData((prev) => ({ ...prev, possible_values: values }));
        setPossibleValueIds(idMap);
        // also update categories state so the list view shows the fetched values
        setCategories((prevCats) =>
          prevCats.map((cat) => ({
            ...cat,
            subcategories: (cat.subcategories || []).map((sub) => ({
              ...sub,
              features: (sub.features || []).map((f) => (f.id === feature.id ? { ...f, possible_values: values } : f)),
            })),
          }))
        );
      } catch (err) {
        // keep existing possible_values if fetch fails
        console.error('Failed to fetch possible values for feature', feature.id, err);
      }
    })();
    setIsFeatureModalOpen(true);
  };

  const handleAddValue = () => {
    const trimmed = newValue.trim();
    if (!trimmed) return;
    if (featureFormData.possible_values.includes(trimmed)) {
      setNewValue('');
      return;
    }

    // If editing an existing feature, persist the possible value via API
    if (editingFeature && editingFeature.id) {
      (async () => {
        try {
          const created = await featuresApi.createPossibleValue({ feature: editingFeature.id, value: trimmed });
          const val = typeof created === 'string' ? created : created.value || trimmed;
          setFeatureFormData((prev) => ({ ...prev, possible_values: [...prev.possible_values, val] }));
          // update id map if server returned an id
          if (created && typeof created === 'object' && created.id) {
            setPossibleValueIds((prev) => ({ ...prev, [val]: created.id }));
          }
          // update categories state so the new value appears in the feature list immediately
          setCategories((prevCats) =>
            prevCats.map((cat) => ({
              ...cat,
              subcategories: (cat.subcategories || []).map((sub) => ({
                ...sub,
                features: (sub.features || []).map((f) => (f.id === editingFeature.id ? { ...f, possible_values: [...(f.possible_values || []), val] } : f)),
              })),
            }))
          );
        } catch (err) {
          console.error('Failed to create possible value', err);
          window.alert('Failed to save possible value');
        } finally {
          setNewValue('');
        }
      })();
    } else {
      // Not yet created feature — just add locally
      setFeatureFormData({
        ...featureFormData,
        possible_values: [...featureFormData.possible_values, trimmed],
      });
      setNewValue('');
    }
  };

  const handleRemoveValue = (valueToRemove: string) => {
    // If this value exists on server, attempt to delete it
    const id = possibleValueIds[valueToRemove];
    if (editingFeature && editingFeature.id && id) {
      (async () => {
        try {
          await featuresApi.deletePossibleValue(id);
        } catch (err) {
          console.error('Failed to delete possible value on server', err);
        }
        // Remove locally
        setFeatureFormData({
          ...featureFormData,
          possible_values: featureFormData.possible_values.filter(v => v !== valueToRemove),
        });
        setPossibleValueIds((prev) => {
          const copy = { ...prev };
          delete copy[valueToRemove];
          return copy;
        });
      })();
    } else {
      setFeatureFormData({
        ...featureFormData,
        possible_values: featureFormData.possible_values.filter(v => v !== valueToRemove),
      });
    }
  };
  // Drag & drop reordering for possible values (HTML5 DnD)
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  const onDragStart = (e: React.DragEvent, index: number) => {
    e.dataTransfer.effectAllowed = 'move';
    setDraggedIndex(index);
  };

  const onDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const onDrop = async (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) {
      setDraggedIndex(null);
      return;
    }

    const arr = [...featureFormData.possible_values];
    const [moved] = arr.splice(draggedIndex, 1);
    arr.splice(index, 0, moved);

    setFeatureFormData((prev) => ({ ...prev, possible_values: arr }));
    setDraggedIndex(null);

    // update categories state so list view reflects new order immediately
    if (editingFeature && editingFeature.id) {
      setCategories((prevCats) =>
        prevCats.map((cat) => ({
          ...cat,
          subcategories: (cat.subcategories || []).map((sub) => ({
            ...sub,
            features: (sub.features || []).map((f) => (f.id === editingFeature.id ? { ...f, possible_values: arr } : f)),
          })),
        }))
      );

      // Persist new order to backend. Re-fetch authoritative possible values
      // to ensure we have the real IDs (and handle duplicates reliably).
      (async () => {
        try {
          const pv = await featuresApi.listPossibleValues(editingFeature.id);
          // Build map: value -> queue of ids
          const idQueues: Record<string, number[]> = {};
          pv.forEach((p: any) => {
            const val = typeof p === 'string' ? p : p.value || p.name || String(p);
            const id = typeof p === 'object' && p.id ? p.id : undefined;
            if (!id) return;
            if (!idQueues[val]) idQueues[val] = [];
            idQueues[val].push(id);
          });

          await Promise.all(
            arr.map((val, idx) => {
              const q = idQueues[val];
              const id = q && q.length > 0 ? q.shift() : undefined;
              if (id) return featuresApi.updatePossibleValue(id, { order: idx });
              return Promise.resolve(null);
            })
          );

          // Update local id map to match backend
          const newIdMap: Record<string, number> = {};
          pv.forEach((p: any) => {
            const val = typeof p === 'string' ? p : p.value || p.name || String(p);
            if (p && typeof p === 'object' && p.id) newIdMap[val] = p.id;
          });
          setPossibleValueIds(newIdMap);
        } catch (err) {
          console.error('Failed to persist possible value order', err);
        }
      })();

      // NOTE: Do NOT send `possible_values` in the feature PUT payload — backend expects
      // only { name, description, subcategory } and returns 400 for unknown fields.
      // If your API exposes a dedicated reorder endpoint for possible values, we can call it here.
    }
  };

  const onDragEnd = () => setDraggedIndex(null);

  const handleDeleteFeature = async (feature: Feature) => {
    if (!window.confirm(`Are you sure you want to delete "${feature.name}"?`)) {
      return;
    }
    try {
      await featuresApi.delete(feature.id);
      fetchCategories();
    } catch (error) {
      console.error('Error deleting feature:', error);
      window.alert('Failed to delete feature');
    }
  };

  const handleSubmitFeature = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingFeature) {
        // Backend expects only name, description and subcategory in the PUT payload.
        await featuresApi.update(editingFeature.id, {
          name: featureFormData.name,
          description: featureFormData.description,
          subcategory: featureFormData.subcategory,
        });
        // Persist any newly added possible values separately via createPossibleValue (handleAddValue already does this).
      } else {
        const newFeature = await featuresApi.create({
          subcategory: featureFormData.subcategory,
          name: featureFormData.name,
          description: featureFormData.description,
        });
        // If we added possible values locally before creating the feature, persist them now
        if (featureFormData.possible_values && featureFormData.possible_values.length > 0) {
          try {
            await Promise.all(
              featureFormData.possible_values.map((v) => featuresApi.createPossibleValue({ feature: newFeature.id, value: v }))
            );
          } catch (pvErr) {
            console.error('Failed to persist possible values for new feature', pvErr);
          }
        }
      }
      setIsFeatureModalOpen(false);
      fetchCategories();
    } catch (error: any) {
      console.error('Error saving feature:', error);
      window.alert(error.response?.data?.detail || 'Failed to save feature');
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-500">Loading categories...</div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold text-gray-900">Categories</h1>
          <Button onClick={handleCreateCategory}>
            <Plus className="h-4 w-4 mr-2" />
            Add Category
          </Button>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-start">
              <div className="flex-1">
                <h3 className="text-sm font-medium text-red-800">Error Loading Categories</h3>
                <p className="mt-1 text-sm text-red-700">{error}</p>
                <button
                  onClick={fetchCategories}
                  className="mt-2 text-sm text-red-600 hover:text-red-800 underline"
                >
                  Try again
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="bg-white rounded-lg shadow">
          {categories.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              No categories found. Create your first category to get started.
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {categories.map((category) => {
                const isExpanded = expandedCategories.has(category.id);
                const subcategories = category.subcategories || [];

                return (
                  <div key={category.id} className="p-4 hover:bg-gray-50 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center flex-1">
                        <button
                          onClick={() => toggleCategory(category.id)}
                          className="mr-3 p-1 hover:bg-gray-200 rounded"
                        >
                          {isExpanded ? (
                            <ChevronDown className="h-5 w-5 text-gray-600" />
                          ) : (
                            <ChevronRight className="h-5 w-5 text-gray-600" />
                          )}
                        </button>
                        <div className="flex-1">
                          <h3 className="text-lg font-semibold text-gray-900">{category.name}</h3>
                          {category.description && (
                            <p className="text-sm text-gray-600 mt-1">{category.description}</p>
                          )}
                          <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                            <span>{subcategories.length} subcategor{subcategories.length !== 1 ? 'ies' : 'y'}</span>
                            {category.created_at && (
                              <span>Created {format(new Date(category.created_at), 'MMM dd, yyyy')}</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleCreateSubCategory(category.id)}
                        >
                          <Plus className="h-4 w-4 mr-1" />
                          Add Subcategory
                        </Button>
                        <button
                          onClick={() => handleEditCategory(category)}
                          className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded"
                          title="Edit category"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteCategory(category)}
                          className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded"
                          title="Delete category"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="mt-4 ml-8 border-l-2 border-gray-200 pl-4 space-y-3">
                        {subcategories.length === 0 ? (
                          <div className="text-sm text-gray-500 py-2">
                            No subcategories. Click &quot;Add Subcategory&quot; to create one.
                          </div>
                        ) : (
                          subcategories.map((subCategory) => {
                            const isSubExpanded = expandedSubCategories.has(subCategory.id);
                            const features = subCategory.features || [];

                            return (
                              <div
                                key={subCategory.id}
                                className="p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                              >
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center flex-1">
                                    <button
                                      onClick={() => toggleSubCategory(subCategory.id)}
                                      className="mr-2 p-1 hover:bg-gray-200 rounded"
                                    >
                                      {isSubExpanded ? (
                                        <ChevronDown className="h-4 w-4 text-gray-600" />
                                      ) : (
                                        <ChevronRight className="h-4 w-4 text-gray-600" />
                                      )}
                                    </button>
                                    <div className="flex-1">
                                      <h4 className="font-medium text-gray-900">{subCategory.name}</h4>
                                      {subCategory.description && (
                                        <p className="text-sm text-gray-600 mt-1">{subCategory.description}</p>
                                      )}
                                      <div className="flex items-center gap-4 mt-1 text-xs text-gray-500">
                                        <span>{features.length} feature{features.length !== 1 ? 's' : ''}</span>
                                        {subCategory.created_at && (
                                          <span>Created {format(new Date(subCategory.created_at), 'MMM dd, yyyy')}</span>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => handleCreateFeature(subCategory.id)}
                                    >
                                      <Plus className="h-3 w-3 mr-1" />
                                      Add Feature
                                    </Button>
                                    <button
                                      onClick={() => handleEditSubCategory(subCategory, category.id)}
                                      className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded"
                                      title="Edit subcategory"
                                    >
                                      <Edit className="h-4 w-4" />
                                    </button>
                                    <button
                                      onClick={() => handleDeleteSubCategory(subCategory)}
                                      className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded"
                                      title="Delete subcategory"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </button>
                                  </div>
                                </div>

                                {isSubExpanded && (
                                  <div className="mt-3 ml-6 border-l-2 border-gray-300 pl-3 space-y-2">
                                    {features.length === 0 ? (
                                      <div className="text-sm text-gray-500 py-2">
                                        No features. Click &quot;Add Feature&quot; to create one.
                                      </div>
                                    ) : (
                                      features.map((feature) => (
                                        <div
                                          key={feature.id}
                                          className="p-2 bg-white rounded border border-gray-200 hover:border-gray-300 transition-colors"
                                        >
                                          <div className="flex items-start justify-between">
                                            <div className="flex-1">
                                              <h5 className="font-medium text-gray-900 text-sm">{feature.name}</h5>
                                              {feature.description && (
                                                <p className="text-xs text-gray-600 mt-1">{feature.description}</p>
                                              )}
                                              {feature.possible_values && feature.possible_values.length > 0 && (
                                                <div className="mt-2">
                                                  <p className="text-xs font-medium text-gray-700 mb-1">
                                                    Values ({feature.possible_values.length}):
                                                  </p>
                                                  <div className="flex flex-wrap gap-1">
                                                    {feature.possible_values.map((value, idx) => {
                                                      const isFromProduct = false; // All values are from possible_values
                                                      return (
                                                        <span
                                                          key={idx}
                                                          className={`px-2 py-0.5 text-xs rounded border ${isFromProduct
                                                            ? 'bg-green-50 text-green-700 border-green-200'
                                                            : 'bg-blue-50 text-blue-700 border-blue-200'
                                                            }`}
                                                          title={isFromProduct ? 'Used in products' : 'Predefined value'}
                                                        >
                                                          {value}
                                                        </span>
                                                      );
                                                    })}
                                                  </div>
                                                </div>
                                              )}
                                              {(!feature.possible_values || feature.possible_values.length === 0) && (
                                                <p className="text-xs text-gray-500 mt-1 italic">No values yet</p>
                                              )}
                                            </div>
                                            <div className="flex items-center gap-1 ml-2">
                                              <button
                                                onClick={() => handleEditFeature(feature)}
                                                className="p-1.5 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded"
                                                title="Edit feature"
                                              >
                                                <Edit className="h-3.5 w-3.5" />
                                              </button>
                                              <button
                                                onClick={() => handleDeleteFeature(feature)}
                                                className="p-1.5 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded"
                                                title="Delete feature"
                                              >
                                                <Trash2 className="h-3.5 w-3.5" />
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
                          })
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Category Modal */}
        <Modal
          isOpen={isCategoryModalOpen}
          onClose={() => setIsCategoryModalOpen(false)}
          title={editingCategory ? 'Edit Category' : 'Create Category'}
        >
          <form onSubmit={handleSubmitCategory} className="space-y-4">
            <Input
              label="Name"
              required
              value={categoryFormData.name}
              onChange={(e) => setCategoryFormData({ ...categoryFormData, name: e.target.value })}
            />
            <Textarea
              label="Description"
              rows={4}
              value={categoryFormData.description}
              onChange={(e) => setCategoryFormData({ ...categoryFormData, description: e.target.value })}
            />
            <div className="flex justify-end space-x-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsCategoryModalOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit">Save</Button>
            </div>
          </form>
        </Modal>

        {/* SubCategory Modal */}
        <Modal
          isOpen={isSubCategoryModalOpen}
          onClose={() => setIsSubCategoryModalOpen(false)}
          title={editingSubCategory ? 'Edit Subcategory' : 'Create Subcategory'}
        >
          <form onSubmit={handleSubmitSubCategory} className="space-y-4">
            <Select
              label="Category"
              required
              value={subCategoryFormData.category}
              onChange={(e) => setSubCategoryFormData({ ...subCategoryFormData, category: parseInt(e.target.value) })}
              options={categories.map(cat => ({ value: cat.id, label: cat.name }))}
            />
            <Input
              label="Name"
              required
              value={subCategoryFormData.name}
              onChange={(e) => setSubCategoryFormData({ ...subCategoryFormData, name: e.target.value })}
            />
            <Textarea
              label="Description"
              rows={4}
              value={subCategoryFormData.description}
              onChange={(e) => setSubCategoryFormData({ ...subCategoryFormData, description: e.target.value })}
            />
            <div className="flex justify-end space-x-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsSubCategoryModalOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit">Save</Button>
            </div>
          </form>
        </Modal>

        {/* Feature Modal */}
        <Modal
          isOpen={isFeatureModalOpen}
          onClose={() => setIsFeatureModalOpen(false)}
          title={editingFeature ? 'Edit Feature' : 'Create Feature'}
        >
          <form onSubmit={handleSubmitFeature} className="space-y-4">
            <Select
              label="Subcategory"
              required
              value={featureFormData.subcategory}
              onChange={(e) => setFeatureFormData({ ...featureFormData, subcategory: parseInt(e.target.value) })}
              options={categories.flatMap(cat =>
                (cat.subcategories || []).map(sub => ({
                  value: sub.id,
                  label: `${cat.name} > ${sub.name}`
                }))
              )}
            />
            <Input
              label="Name"
              required
              value={featureFormData.name}
              onChange={(e) => setFeatureFormData({ ...featureFormData, name: e.target.value })}
            />
            <Textarea
              label="Description"
              required
              rows={4}
              value={featureFormData.description}
              onChange={(e) => setFeatureFormData({ ...featureFormData, description: e.target.value })}
            />

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Possible Values
              </label>
              <div className="flex gap-2 mb-2">
                <Input
                  placeholder="Enter a value"
                  value={newValue}
                  onChange={(e) => setNewValue(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddValue();
                    }
                  }}
                />
                <Button
                  type="button"
                  onClick={handleAddValue}
                  variant="outline"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add
                </Button>
              </div>
              {featureFormData.possible_values.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {featureFormData.possible_values.map((value, idx) => (
                    <span
                      key={idx}
                      draggable
                      onDragStart={(e) => onDragStart(e, idx)}
                      onDragOver={(e) => onDragOver(e, idx)}
                      onDrop={(e) => onDrop(e, idx)}
                      onDragEnd={onDragEnd}
                      className={`inline-flex items-center gap-2 px-3 py-1 bg-blue-50 text-blue-700 text-sm rounded-full border border-blue-200 cursor-move ${draggedIndex === idx ? 'opacity-60' : ''}`}
                      title="Drag to reorder"
                    >
                      <span className="mr-1 select-none">{value}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveValue(value)}
                        className="text-blue-600 hover:text-blue-800 ml-1"
                        title="Remove value"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
              <p className="text-xs text-gray-500 mt-2">
                Add possible values for this feature. These will be available when creating products.
              </p>
            </div>
            <div className="flex justify-end space-x-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsFeatureModalOpen(false)}
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
