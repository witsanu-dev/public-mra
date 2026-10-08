'use client';

import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useIpdAuditStore } from '@/store/useIpdAuditStore';
import { useAuthStore } from '@/store/useAuthStore';
import { RBAC } from '@/lib/rbac';
import { allIpdCriteriaList } from '@/lib/mra-ipd-types';
import { Search } from 'lucide-react';

const SCORE_STYLES: Record<string, string> = {
  '1': 'bg-emerald-600 border-emerald-600 text-white shadow-xs',
  '0': 'bg-pink-600 border-pink-600 text-white shadow-xs',
  'NA': 'bg-slate-500 border-slate-500 text-white shadow-xs',
  'M': 'bg-amber-500 border-amber-500 text-white shadow-xs',
};
const SCORE_DEFAULT =
  'bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50';

export function IpdCriteriaView() {
  const { rows, searchQuery, setSearchQuery, setCriteriaScore } = useIpdAuditStore();
  const { user } = useAuthStore();
  const isReadOnly = RBAC.isReadOnly(user?.role);

  const filtered = allIpdCriteriaList.filter(
    (c) =>
      c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const grouped = filtered.reduce(
    (acc, item) => {
      if (!acc[item.category]) acc[item.category] = [];
      acc[item.category].push(item);
      return acc;
    },
    {} as Record<string, typeof allIpdCriteriaList>
  );

  const getScore = (rowId: string, criteriaIndex: number) => {
    const row = rows.find((r) => r.id === rowId);
    if (!row) return null;
    if (row.naSelected) return 'NA';
    if (row.missingSelected) return 'M';
    return row.scores[criteriaIndex];
  };

  return (
    <div className="space-y-4">
      {/* Search / header card */}
      <Card>
        <CardHeader className="flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white">
          <div className="flex items-center gap-2 flex-wrap">
            <CardTitle className="text-blue-950 text-base leading-snug">
              รายละเอียดเกณฑ์การตรวจประเมินผู้ป่วยใน (IPD 12 หมวด)
            </CardTitle>
            <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-sm font-medium border border-blue-200 shrink-0">
              {filtered.length} ข้อเกณฑ์
            </span>
          </div>
          <div className="w-full sm:w-72">
            <Input
              isSearchable
              placeholder="ค้นหาข้อกำหนด คำสำคัญ หรือหมวด..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </CardHeader>

        <CardContent className="space-y-5">
          {Object.keys(grouped).length === 0 && (
            <div className="py-12 text-center text-slate-400">
              <Search size={32} className="mx-auto mb-2 text-slate-300" />
              <p className="text-sm">ไม่พบข้อกำหนดที่ค้นหา</p>
            </div>
          )}

          {Object.keys(grouped).map((category, idx) => (
            <div key={category} className="space-y-2">
              {/* Category header */}
              <div className="flex items-center justify-between bg-blue-50/70 border border-blue-100 px-4 py-2.5 rounded-sm">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-sm bg-blue-900 text-white flex items-center justify-center text-xs font-semibold shrink-0">
                    {idx + 1}
                  </span>
                  <h2 className="text-xs font-bold text-blue-950 tracking-wide uppercase">
                    {category}
                  </h2>
                </div>
                <span className="text-[11px] text-blue-700 font-medium">
                  {grouped[category].length} ข้อ
                </span>
              </div>

              {/* Criteria list */}
              <div className="border border-slate-200 rounded-sm divide-y divide-slate-100 overflow-hidden bg-white">
                {grouped[category].map((item) => {
                  const current = getScore(item.rowId, item.criteriaIndex);

                  return (
                    <div
                      key={item.id}
                      className="flex flex-col sm:flex-row sm:items-center justify-between p-4 gap-3 hover:bg-slate-50/80 transition-colors"
                    >
                      {/* Criteria description */}
                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-start gap-2 flex-wrap">
                          <span className="px-1.5 py-0.5 rounded-sm bg-slate-100 text-slate-700 text-xs font-bold border border-slate-200 shrink-0">
                            ข้อที่ {item.criteriaNo}
                          </span>
                          <h4 className="text-sm font-semibold text-slate-900 leading-snug">
                            {item.title}
                          </h4>
                        </div>
                        <p className="text-xs text-slate-600 leading-relaxed pl-1">
                          {item.description}
                        </p>
                      </div>

                      {/* Score buttons */}
                      <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                        {(['1', '0', 'NA', 'M'] as const).map((val) => {
                          const show = val !== 'NA' || item.canBeNA;
                          if (!show) return <div key={val} className="w-10 h-10 sm:w-9 sm:h-8" />;
                          return (
                            <button
                              key={val}
                              type="button"
                              disabled={isReadOnly}
                              onClick={() => setCriteriaScore(item.rowId, item.criteriaIndex, val)}
                              className={[
                                'w-10 h-10 sm:w-9 sm:h-8 rounded-sm text-xs font-semibold border transition-colors',
                                current === val ? SCORE_STYLES[val] : SCORE_DEFAULT,
                                isReadOnly ? 'cursor-default opacity-85 select-none' : 'cursor-pointer',
                              ].join(' ')}
                              title={
                                val === '1'
                                  ? 'ผ่านเกณฑ์'
                                  : val === '0'
                                    ? 'ไม่ผ่านเกณฑ์'
                                    : val === 'NA'
                                      ? 'ไม่ต้องประเมิน'
                                      : 'Missing — เอกสารสูญหาย'
                              }
                            >
                              {val}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
