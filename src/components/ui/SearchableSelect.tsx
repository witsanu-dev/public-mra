'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Search, ChevronDown, X, Check } from 'lucide-react';

export interface SearchableOption {
  value: string;
  label: string;
  subLabel?: string;
  badge?: string;
}

interface SearchableSelectProps {
  options: SearchableOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  disabled?: boolean;
  className?: string;
  triggerClassName?: string;
  dropdownClassName?: string;
  matchTriggerWidth?: boolean;
  allOptionLabel?: string;
  icon?: React.ReactNode;
  id?: string;
}

export function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = 'เลือกตัวเลือก...',
  searchPlaceholder = 'พิมพ์ค้นหา...',
  emptyMessage = 'ไม่พบข้อมูลที่ค้นหา',
  disabled = false,
  className = '',
  triggerClassName,
  dropdownClassName,
  matchTriggerWidth = false,
  allOptionLabel,
  icon,
  id,
}: SearchableSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const [dropDirection, setDropDirection] = useState<'down' | 'up'>('down');

  // Determine open direction and focus search input
  useEffect(() => {
    if (isOpen) {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const spaceBelow = window.innerHeight - rect.bottom;
        const spaceAbove = rect.top;
        if (spaceBelow < 280 && spaceAbove > 280) {
          setDropDirection('up');
        } else {
          setDropDirection('down');
        }
      }
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    } else {
      setSearchQuery('');
    }
  }, [isOpen]);

  // Find currently selected option
  const selectedOption = useMemo(() => {
    return options.find((opt) => opt.value === value);
  }, [options, value]);

  // Filtered options based on search query
  const filteredOptions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return options;
    return options.filter((opt) => {
      const matchVal = (opt.value || '').toLowerCase().includes(q);
      const matchLabel = (opt.label || '').toLowerCase().includes(q);
      const matchSub = (opt.subLabel || '').toLowerCase().includes(q);
      const matchBadge = (opt.badge || '').toLowerCase().includes(q);
      return matchVal || matchLabel || matchSub || matchBadge;
    });
  }, [options, searchQuery]);

  const handleSelect = (val: string) => {
    onChange(val);
    setIsOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('');
    setSearchQuery('');
  };

  return (
    <div ref={containerRef} className={`relative w-full ${isOpen ? 'z-[100]' : 'z-auto'} ${className}`}>
      {/* Trigger Button */}
      <button
        id={id}
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={`w-full rounded-sm border text-left flex items-center justify-between gap-2 px-3 text-xs transition-colors bg-white ${
          triggerClassName ? triggerClassName : 'h-10 sm:h-9'
        } ${
          disabled
            ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
            : isOpen
            ? 'border-pink-500 ring-1 ring-pink-500 text-slate-900 shadow-xs'
            : 'border-slate-300 hover:border-slate-400 text-slate-900 shadow-xs'
        }`}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {icon && <span className="text-slate-400 shrink-0">{icon}</span>}
          {selectedOption ? (
            <span className="truncate font-medium text-slate-800">
              {selectedOption.badge && (
                <span className="inline-block px-1.5 py-0.2 rounded-sm bg-slate-100 text-slate-600 font-medium text-[10px] mr-1.5 border border-slate-200">
                  {selectedOption.badge}
                </span>
              )}
              {selectedOption.label}
            </span>
          ) : (
            <span className="truncate text-slate-400">
              {allOptionLabel && !value ? allOptionLabel : placeholder}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {value && !disabled && (
            <span
              role="button"
              tabIndex={0}
              onClick={handleClear}
              onKeyDown={(e) => e.key === 'Enter' && handleClear(e as any)}
              className="p-1 text-slate-400 hover:text-slate-700 rounded-sm hover:bg-slate-100 transition-colors"
              title="ล้างค่าที่เลือก"
            >
              <X size={13} />
            </span>
          )}
          <ChevronDown
            size={14}
            className={`text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180 text-pink-600' : ''}`}
          />
        </div>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          className={`absolute z-[9999] left-0 ${
            dropdownClassName
              ? dropdownClassName
              : matchTriggerWidth
              ? 'w-full min-w-full max-w-full'
              : 'min-w-full sm:min-w-[240px]'
          } bg-white rounded-sm border border-slate-200 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-100 ${
            dropDirection === 'up' ? 'bottom-full mb-1.5' : 'top-full mt-1.5'
          }`}
        >
          {/* Search Box */}
          <div className="p-2 border-b border-slate-100 bg-slate-50/70">
            <div className="relative flex items-center">
              <Search size={14} className="absolute left-2.5 text-slate-400 pointer-events-none" />
              <input
                ref={inputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') setIsOpen(false);
                  if (e.key === 'Enter' && filteredOptions.length > 0) {
                    handleSelect(filteredOptions[0].value);
                  }
                }}
                placeholder={searchPlaceholder}
                className="w-full pl-8 pr-7 py-1.5 text-xs rounded-sm border border-slate-200 bg-white text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-pink-500 focus:border-pink-500"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 text-slate-400 hover:text-slate-600 p-0.5"
                >
                  <X size={12} />
                </button>
              )}
            </div>
            {filteredOptions.length > 0 && searchQuery && (
              <div className="text-[10px] text-slate-500 mt-1 px-1 flex justify-between">
                <span>พบ {filteredOptions.length} รายการ</span>
                <span className="text-slate-400">กด Enter เพื่อเลือกรายการแรก</span>
              </div>
            )}
          </div>

          {/* Options List */}
          <div className="max-h-60 overflow-y-auto divide-y divide-slate-50 py-1" role="listbox">
            {/* Optional "All" item */}
            {allOptionLabel && !searchQuery && (
              <button
                type="button"
                onClick={() => handleSelect('')}
                className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between hover:bg-pink-50/50 transition-colors ${
                  value === '' ? 'bg-pink-50 font-semibold text-pink-700' : 'text-slate-700'
                }`}
                role="option"
                aria-selected={value === ''}
              >
                <span>{allOptionLabel}</span>
                {value === '' && <Check size={14} className="text-pink-600 shrink-0" />}
              </button>
            )}

            {filteredOptions.length > 0 ? (
              filteredOptions.map((opt) => {
                const isSelected = opt.value === value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => handleSelect(opt.value)}
                    className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between hover:bg-slate-50 transition-colors ${
                      isSelected ? 'bg-pink-50/80 font-semibold text-pink-800' : 'text-slate-700'
                    }`}
                    role="option"
                    aria-selected={isSelected}
                  >
                    <div className="flex items-center gap-2 min-w-0 pr-2">
                      {opt.badge && (
                        <span className="inline-block px-1.5 py-0.5 rounded-sm bg-slate-100 text-slate-600 font-medium text-[10px] shrink-0 border border-slate-200">
                          {opt.badge}
                        </span>
                      )}
                      <div className="truncate">
                        <div className="truncate">{opt.label}</div>
                        {opt.subLabel && (
                          <div className="text-[10px] text-slate-400 truncate">{opt.subLabel}</div>
                        )}
                      </div>
                    </div>
                    {isSelected && <Check size={14} className="text-pink-600 shrink-0" />}
                  </button>
                );
              })
            ) : (
              <div className="py-6 text-center text-xs text-slate-400 px-3">
                <p>{emptyMessage}</p>
                {searchQuery && (
                  <p className="text-[11px] text-slate-400 mt-1">"{searchQuery}"</p>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
