'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronDown, Plus, Building2, Check } from 'lucide-react';
import { useBar } from '@/contexts/page';

export default function PlaceSwitcher() {
  const router = useRouter();
  const { currentBarId, userBars, setCurrentBar, isLoading } = useBar();
  const [showDropdown, setShowDropdown] = useState(false);
  const [switching, setSwitching] = useState(false);

  const currentPlace = userBars.find(bar => bar.id === currentBarId);

  const handlePlaceSwitch = async (placeId: string) => {
    if (placeId === currentBarId) {
      setShowDropdown(false);
      return;
    }

    try {
      setSwitching(true);
      await setCurrentBar(placeId);
      setShowDropdown(false);
      
      // Reload the page to refresh all data for the new place
      window.location.reload();
    } catch (error) {
      console.error('Failed to switch place:', error);
      alert('Failed to switch place. Please try again.');
    } finally {
      setSwitching(false);
    }
  };

  const handleCreateNewPlace = () => {
    setShowDropdown(false);
    router.push('/signup');
  };

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-white/10 rounded-lg">
        <Building2 size={20} />
        <span className="text-sm">Loading...</span>
      </div>
    );
  }

  if (userBars.length === 0) {
    return null;
  }

  // If only one place, show it without dropdown
  if (userBars.length === 1) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-white/10 rounded-lg">
        <Building2 size={20} />
        <span className="text-sm font-medium">{currentPlace?.name || 'Place'}</span>
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        disabled={switching}
        className="flex items-center gap-2 px-3 py-2 bg-white/10 rounded-lg hover:bg-white/20 transition disabled:opacity-50"
      >
        <Building2 size={20} />
        <span className="text-sm font-medium">{currentPlace?.name || 'Select Place'}</span>
        <ChevronDown size={16} className={`transition-transform ${showDropdown ? 'rotate-180' : ''}`} />
      </button>

      {showDropdown && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setShowDropdown(false)}
          />

          {/* Dropdown Menu */}
          <div className="absolute top-full right-0 mt-2 w-64 bg-white rounded-lg shadow-xl border border-gray-200 z-50 overflow-hidden">
            {/* Place List */}
            <div className="max-h-64 overflow-y-auto">
              {userBars.map((place) => (
                <button
                  key={place.id}
                  onClick={() => handlePlaceSwitch(place.id)}
                  disabled={switching}
                  className={`w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition text-left disabled:opacity-50 ${
                    place.id === currentBarId ? 'bg-orange-50' : ''
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 truncate">{place.name}</p>
                    <p className="text-xs text-gray-500 capitalize">{place.role}</p>
                  </div>
                  {place.id === currentBarId && (
                    <Check size={20} className="text-orange-600 flex-shrink-0 ml-2" />
                  )}
                </button>
              ))}
            </div>

            {/* Create New Place Button */}
            <div className="border-t border-gray-200">
              <button
                onClick={handleCreateNewPlace}
                disabled={switching}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition text-left disabled:opacity-50"
              >
                <div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Plus size={20} className="text-orange-600" />
                </div>
                <div>
                  <p className="font-medium text-gray-900">Create New Place</p>
                  <p className="text-xs text-gray-500">Add another place</p>
                </div>
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
