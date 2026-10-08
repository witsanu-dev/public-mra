'use client';

import { apiUrl, assetUrl } from '@/lib/constants';
import React, { useState, useRef, useEffect, useCallback, memo } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import {
  BookOpen,
  Download,
  FileText,
  Maximize2,
  Minimize2,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ZoomIn,
  ZoomOut,
  RotateCw,
} from 'lucide-react';
import { alertSuccess, alertError } from '@/lib/mra-alert';

declare global {
  interface Window {
    pdfjsLib?: {
      GlobalWorkerOptions: { workerSrc: string };
      getDocument: (params: { url?: string; data?: Uint8Array } | string) => {
        promise: Promise<PDFDocumentProxy>;
      };
    };
  }
}

interface PDFRenderTask {
  promise: Promise<void>;
  cancel: () => void;
}

interface PDFPageProxy {
  getViewport: (params: { scale: number; rotation?: number }) => { width: number; height: number };
  render: (params: {
    canvasContext: CanvasRenderingContext2D;
    viewport: { width: number; height: number };
  }) => PDFRenderTask;
}

interface PDFDocumentProxy {
  numPages: number;
  getPage: (pageNumber: number) => Promise<PDFPageProxy>;
}

// ── Continuous Scroll Page Item with Lazy Viewport Rendering ─────────────────
interface PdfPageItemProps {
  pageNum: number;
  pdfDoc: PDFDocumentProxy;
  zoomScale: number;
  rotation: number;
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
  onIntersect: (pageNum: number) => void;
}

const PdfPageItem = memo(function PdfPageItem({
  pageNum,
  pdfDoc,
  zoomScale,
  rotation,
  scrollContainerRef,
  onIntersect,
}: PdfPageItemProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const renderTaskRef = useRef<PDFRenderTask | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isRendered, setIsRendered] = useState(false);
  const [dimensions, setDimensions] = useState<{ width: number; height: number }>({
    width: 595 * zoomScale,
    height: 842 * zoomScale,
  });

  // Keep placeholder dimensions synchronized when zoom or rotation changes
  useEffect(() => {
    const isRotated = rotation === 90 || rotation === 270;
    const baseW = isRotated ? 842 : 595;
    const baseH = isRotated ? 595 : 842;
    setDimensions({
      width: Math.floor(baseW * zoomScale),
      height: Math.floor(baseH * zoomScale),
    });
  }, [zoomScale, rotation]);

  // 1. Observer for viewport entry (lazy render) and center intersection (active page tracker)
  useEffect(() => {
    const el = containerRef.current;
    if (!el || !scrollContainerRef.current) return;

    // Observer 1: Render when within 500px of viewport
    const renderObserver = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry?.isIntersecting) {
          setIsVisible(true);
        } else {
          // Unload canvas when scrolled far away (>1200px) to save RAM
          if (entry && Math.abs(entry.boundingClientRect.top) > 1500) {
            setIsVisible(false);
            setIsRendered(false);
          }
        }
      },
      {
        root: scrollContainerRef.current,
        rootMargin: '600px 0px',
      }
    );

    // Observer 2: Active page tracker (triggers when page is in focus)
    const activeObserver = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry?.isIntersecting && entry.intersectionRatio > 0.4) {
          onIntersect(pageNum);
        }
      },
      {
        root: scrollContainerRef.current,
        threshold: [0.4, 0.6],
      }
    );

    renderObserver.observe(el);
    activeObserver.observe(el);

    return () => {
      renderObserver.disconnect();
      activeObserver.disconnect();
    };
  }, [pageNum, scrollContainerRef, onIntersect]);

  // 2. Render Page to Canvas when visible
  useEffect(() => {
    let isCancelled = false;

    const renderPage = async () => {
      if (!isVisible || !pdfDoc || !canvasRef.current) return;

      try {
        if (renderTaskRef.current) {
          try {
            renderTaskRef.current.cancel();
          } catch {
            // Ignore cancel
          }
          renderTaskRef.current = null;
        }

        const page = await pdfDoc.getPage(pageNum);
        if (isCancelled) return;

        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const dpr = window.devicePixelRatio || 1;
        const viewport = page.getViewport({ scale: zoomScale, rotation });

        setDimensions({
          width: Math.floor(viewport.width),
          height: Math.floor(viewport.height),
        });

        canvas.width = Math.floor(viewport.width * dpr);
        canvas.height = Math.floor(viewport.height * dpr);
        canvas.style.width = `${Math.floor(viewport.width)}px`;
        canvas.style.height = `${Math.floor(viewport.height)}px`;

        ctx.save();
        ctx.scale(dpr, dpr);

        const task = page.render({
          canvasContext: ctx,
          viewport,
        });
        renderTaskRef.current = task;

        await task.promise;
        renderTaskRef.current = null;
        ctx.restore();

        if (!isCancelled) {
          setIsRendered(true);
        }
      } catch (err: unknown) {
        if ((err as { name?: string })?.name !== 'RenderingCancelledException') {
          console.error(`Page ${pageNum} render error:`, err);
        }
      }
    };

    renderPage();

    return () => {
      isCancelled = true;
      if (renderTaskRef.current) {
        try {
          renderTaskRef.current.cancel();
        } catch {
          // Ignore
        }
      }
    };
  }, [isVisible, pdfDoc, pageNum, zoomScale, rotation]);

  return (
    <div
      ref={containerRef}
      id={`pdf-page-${pageNum}`}
      className="relative my-3 flex flex-col items-center justify-center transition-all"
      style={{
        minHeight: `${dimensions.height}px`,
        width: `${dimensions.width}px`,
      }}
    >
      <div
        className="bg-white shadow-md border border-slate-200/90 rounded-xs relative overflow-hidden"
        style={{
          width: `${dimensions.width}px`,
          height: `${dimensions.height}px`,
        }}
      >
        {isVisible ? (
          <canvas ref={canvasRef} className="block w-full h-full" />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center bg-slate-50 text-slate-300">
            <span className="font-mono text-xs">กำลังเตรียมหน้า {pageNum}...</span>
          </div>
        )}

        {!isRendered && isVisible && (
          <div className="absolute inset-0 bg-slate-50/70 flex items-center justify-center">
            <RefreshCw size={20} className="animate-spin text-blue-900/60" />
          </div>
        )}
      </div>

      <span className="text-[10px] text-slate-400 font-mono mt-1 select-none">
        หน้า {pageNum}
      </span>
    </div>
  );
});

export default function ManualPage() {
  const [downloading, setDownloading] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // PDF Viewer States
  const [pdfDoc, setPdfDoc] = useState<PDFDocumentProxy | null>(null);
  const [numPages, setNumPages] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageInput, setPageInput] = useState<string>('1');
  const [zoomScale, setZoomScale] = useState<number>(1.25);
  const [rotation, setRotation] = useState<number>(0);
  const [loadingPdf, setLoadingPdf] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const viewerContainerRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // 1. Download PDF Handler (Pink Button)
  const handleDownload = async () => {
    try {
      setDownloading(true);
      const filename = 'คู่มือมาตรฐานการตรวจประเมินคุณภาพเวชระเบียน_eMRA.pdf';
      const url = apiUrl(`/api/docs/manual?download=true&filename=${encodeURIComponent(filename)}`);

      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      await alertSuccess({
        title: 'เริ่มการดาวน์โหลด',
        text: 'ระบบกำลังดาวน์โหลดไฟล์คู่มือมาตรฐาน (PDF, ~10.5 MB) กรุณารอสักครู่',
      });
    } catch (err) {
      console.error(err);
      await alertError({
        title: 'เกิดข้อผิดพลาด',
        text: 'ไม่สามารถดาวน์โหลดไฟล์คู่มือได้ กรุณาลองใหม่อีกครั้ง',
      });
    } finally {
      setDownloading(false);
    }
  };

  // 2. Load PDF.js library and fetch Base64 JSON (Immune to IDM / Interceptors)
  useEffect(() => {
    let isMounted = true;

    const loadPdfJs = async () => {
      try {
        setLoadingPdf(true);
        setLoadError(null);

        // Load standalone pdf.min.js if not yet available
        if (!window.pdfjsLib) {
          await new Promise<void>((resolve, reject) => {
            const script = document.createElement('script');
            script.src = assetUrl('/vendor/pdfjs/pdf.min.js');
            script.async = true;
            script.onload = () => resolve();
            script.onerror = () => reject(new Error('ไม่สามารถโหลดตัวอ่านเอกสาร PDF ได้'));
            document.head.appendChild(script);
          });
        }

        if (!window.pdfjsLib) {
          throw new Error('PDF.js library is missing');
        }

        window.pdfjsLib.GlobalWorkerOptions.workerSrc = assetUrl('/vendor/pdfjs/pdf.worker.min.js');

        // Fetch binary data encoded in JSON — 100% immune to IDM and all download managers
        const response = await fetch(apiUrl('/api/docs/manual?format=base64'));
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ไม่สามารถดาวน์โหลดข้อมูลเอกสารได้`);
        }
        const json = await response.json();
        if (!json.success || !json.data) {
          throw new Error('ไม่พบข้อมูลเอกสารในระบบ');
        }

        // Fast base64 decode to Uint8Array in memory (~25ms for 10.5MB)
        const binaryString = atob(json.data);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }

        // Load PDF document from in-memory Uint8Array buffer
        const loadingTask = window.pdfjsLib.getDocument({
          data: bytes,
        });

        const doc = await loadingTask.promise;
        if (!isMounted) return;

        setPdfDoc(doc);
        setNumPages(doc.numPages);
        setCurrentPage(1);
        setPageInput('1');
        setLoadingPdf(false);
      } catch (err) {
        console.error('Failed to load PDF:', err);
        if (isMounted) {
          setLoadError('ไม่สามารถโหลดเอกสารคู่มือมาตรฐานได้ กรุณาลองใหม่อีกครั้ง');
          setLoadingPdf(false);
        }
      }
    };

    loadPdfJs();

    return () => {
      isMounted = false;
    };
  }, []);

  // 3. Scroll to specific page smoothly
  const scrollToPage = (targetPage: number) => {
    if (targetPage < 1 || targetPage > numPages) return;
    const pageEl = document.getElementById(`pdf-page-${targetPage}`);
    if (pageEl && scrollContainerRef.current) {
      pageEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setCurrentPage(targetPage);
      setPageInput(String(targetPage));
    }
  };

  const handleActivePageIntersect = useCallback((p: number) => {
    setCurrentPage(p);
    setPageInput(String(p));
  }, []);

  const goToFirstPage = () => scrollToPage(1);
  const goToLastPage = () => scrollToPage(numPages);
  const goToPrevPage = () => scrollToPage(currentPage - 1);
  const goToNextPage = () => scrollToPage(currentPage + 1);

  const handlePageInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPageInput(e.target.value);
  };

  const handlePageInputSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const p = parseInt(pageInput, 10);
    if (!isNaN(p) && p >= 1 && p <= numPages) {
      scrollToPage(p);
    } else {
      setPageInput(String(currentPage));
    }
  };

  // Zoom Handlers
  const zoomIn = () => setZoomScale((prev) => Math.min(prev + 0.2, 2.5));
  const zoomOut = () => setZoomScale((prev) => Math.max(prev - 0.2, 0.6));
  const resetZoom = () => setZoomScale(1.25);
  const rotatePage = () => setRotation((prev) => (prev + 90) % 360);

  // 4. Native Wheel Listener for Isolated Scroll & Ctrl+Wheel Zoom
  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;

    const onNativeWheel = (e: WheelEvent) => {
      // Ctrl + Wheel: Smooth Zoom
      if (e.ctrlKey) {
        e.preventDefault();
        e.stopPropagation();
        if (e.deltaY < 0) {
          setZoomScale((prev) => Math.min(prev + 0.15, 2.5));
        } else {
          setZoomScale((prev) => Math.max(prev - 0.15, 0.6));
        }
        return;
      }

      // Stop wheel propagation so parent screen never shifts or moves!
      e.stopPropagation();
    };

    el.addEventListener('wheel', onNativeWheel, { passive: false });
    return () => {
      el.removeEventListener('wheel', onNativeWheel);
    };
  }, []);

  // Keyboard Navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'SELECT') return;
      if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        goToPrevPage();
      } else if (e.key === 'ArrowRight' || e.key === 'PageDown') {
        goToNextPage();
      } else if (e.key === 'Home') {
        goToFirstPage();
      } else if (e.key === 'End') {
        goToLastPage();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  });

  // Toggle Fullscreen Mode
  const toggleFullscreen = () => {
    if (!viewerContainerRef.current) return;
    if (!document.fullscreenElement) {
      viewerContainerRef.current
        .requestFullscreen()
        .then(() => setIsFullscreen(true))
        .catch(() => setIsFullscreen(!isFullscreen));
    } else {
      document
        .exitFullscreen()
        .then(() => setIsFullscreen(false))
        .catch(() => setIsFullscreen(false));
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      {/* ── In-Page PDF Reader Card with Unified Compact Command Header ── */}
      <Card
        ref={viewerContainerRef}
        className={`rounded-sm border-slate-200 shadow-xs overflow-hidden transition-all flex-1 min-h-0 flex flex-col ${isFullscreen
          ? 'fixed inset-0 z-50 rounded-none border-0 h-screen w-screen bg-slate-900'
          : 'bg-white'
          }`}
      >
        {/* ── Unified Modern Compact Header & PDF Toolbar ── */}
        <CardHeader
          className={`px-3 py-2 sm:px-4 sm:py-2.5 border-b flex flex-col lg:flex-row lg:items-center justify-between gap-2.5 shrink-0 transition-colors ${isFullscreen
            ? 'bg-slate-900 text-white border-slate-800'
            : 'bg-white text-slate-800 border-slate-200'
            }`}
        >
          {/* Left: Document Info (Icon, Title, Subtitle) */}
          <div className="flex items-center gap-2.5 min-w-0">
            <div className={`w-8.5 h-8.5 rounded-sm flex items-center justify-center shrink-0 shadow-2xs ${isFullscreen ? 'bg-blue-600 text-white' : 'bg-blue-900 text-white'
              }`}>
              <BookOpen size={17} />
            </div>
            <div className="min-w-0">
              <h1 className={`text-xs sm:text-sm font-bold truncate leading-tight ${isFullscreen ? 'text-white' : 'text-blue-950'
                }`}>
                คู่มือมาตรฐานการตรวจประเมินคุณภาพ
              </h1>
              <p className={`text-[10px] font-semibold uppercase tracking-wider mt-0.5 truncate ${isFullscreen ? 'text-slate-400' : 'text-slate-500'
                }`}>
                MEDICAL RECORD AUDIT GUIDELINE: MRA
              </p>
            </div>
          </div>

          {/* Right: Compact PDF Controls & Download Action */}
          <div className="flex items-center flex-wrap sm:flex-nowrap gap-2 shrink-0">
            {/* Pill Group 1: Page Navigation */}
            <div className={`inline-flex items-center p-0.5 rounded-sm border ${isFullscreen
              ? 'bg-slate-800/90 border-slate-700/80 text-slate-200'
              : 'bg-slate-100/90 border-slate-200/90 text-slate-700'
              }`}>
              <button
                type="button"
                onClick={goToFirstPage}
                disabled={currentPage <= 1 || loadingPdf}
                className={`p-1.5 rounded-xs transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed ${isFullscreen ? 'hover:bg-slate-700 text-slate-300' : 'hover:bg-white text-slate-600 hover:text-slate-900'
                  }`}
                title="หน้าแรกสุด (Home)"
              >
                <ChevronsLeft size={13} />
              </button>

              <button
                type="button"
                onClick={goToPrevPage}
                disabled={currentPage <= 1 || loadingPdf}
                className={`p-1.5 rounded-xs transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed ${isFullscreen ? 'hover:bg-slate-700 text-slate-300' : 'hover:bg-white text-slate-600 hover:text-slate-900'
                  }`}
                title="หน้าก่อนหน้า (← หรือ PageUp)"
              >
                <ChevronLeft size={13} />
              </button>

              <form
                onSubmit={handlePageInputSubmit}
                className="flex items-center gap-1 px-1.5"
                title="พิมพ์เลขหน้าแล้วกด Enter เพื่อกระโดดข้ามหน้า"
              >
                <input
                  type="text"
                  value={pageInput}
                  onChange={handlePageInputChange}
                  onBlur={handlePageInputSubmit}
                  disabled={loadingPdf}
                  title="พิมพ์เลขหน้า (1-172) แล้วกด Enter"
                  placeholder="1"
                  className={`w-9 h-6 text-center text-[11px] font-mono font-bold rounded-xs border focus:outline-none focus:ring-1 focus:ring-blue-900 ${isFullscreen
                    ? 'bg-slate-900 border-slate-700 text-white'
                    : 'bg-white border-slate-300 text-slate-800 shadow-2xs'
                    }`}
                />
                <span className={`text-[11px] font-mono font-medium ${isFullscreen ? 'text-slate-400' : 'text-slate-500'
                  }`}>
                  / {numPages || '-'}
                </span>
              </form>

              <button
                type="button"
                onClick={goToNextPage}
                disabled={currentPage >= numPages || loadingPdf}
                className={`p-1.5 rounded-xs transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed ${isFullscreen ? 'hover:bg-slate-700 text-slate-300' : 'hover:bg-white text-slate-600 hover:text-slate-900'
                  }`}
                title="หน้าถัดไป (→ หรือ PageDown)"
              >
                <ChevronRight size={13} />
              </button>

              <button
                type="button"
                onClick={goToLastPage}
                disabled={currentPage >= numPages || loadingPdf}
                className={`p-1.5 rounded-xs transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed ${isFullscreen ? 'hover:bg-slate-700 text-slate-300' : 'hover:bg-white text-slate-600 hover:text-slate-900'
                  }`}
                title="หน้าสุดท้าย (End)"
              >
                <ChevronsRight size={13} />
              </button>
            </div>

            {/* Pill Group 2: Zoom, Rotate & View */}
            <div className={`inline-flex items-center p-0.5 rounded-sm border ${isFullscreen
              ? 'bg-slate-800/90 border-slate-700/80 text-slate-200'
              : 'bg-slate-100/90 border-slate-200/90 text-slate-700'
              }`}>
              <button
                type="button"
                onClick={zoomOut}
                disabled={loadingPdf}
                className={`p-1.5 rounded-xs transition-colors cursor-pointer ${isFullscreen ? 'hover:bg-slate-700 text-slate-300' : 'hover:bg-white text-slate-600 hover:text-slate-900'
                  }`}
                title="ย่อขนาด (-)"
              >
                <ZoomOut size={13} />
              </button>

              <button
                type="button"
                onClick={resetZoom}
                disabled={loadingPdf}
                className={`px-1.5 h-6 text-[11px] font-mono font-semibold rounded-xs transition-colors cursor-pointer ${isFullscreen ? 'hover:bg-slate-700 text-slate-200' : 'hover:bg-white text-slate-700'
                  }`}
                title="คลิกเพื่อสลับขนาด 100% / 125%"
              >
                {Math.round(zoomScale * 100)}%
              </button>

              <button
                type="button"
                onClick={zoomIn}
                disabled={loadingPdf}
                className={`p-1.5 rounded-xs transition-colors cursor-pointer ${isFullscreen ? 'hover:bg-slate-700 text-slate-300' : 'hover:bg-white text-slate-600 hover:text-slate-900'
                  }`}
                title="ขยายขนาด (+)"
              >
                <ZoomIn size={13} />
              </button>

              <div className={`w-px h-3.5 mx-0.5 ${isFullscreen ? 'bg-slate-700' : 'bg-slate-300'}`} />

              <button
                type="button"
                onClick={rotatePage}
                disabled={loadingPdf}
                className={`p-1.5 rounded-xs transition-colors cursor-pointer ${isFullscreen ? 'hover:bg-slate-700 text-slate-300' : 'hover:bg-white text-slate-600 hover:text-slate-900'
                  }`}
                title="หมุนหน้าเอกสาร 90°"
              >
                <RotateCw size={13} />
              </button>

              <button
                type="button"
                onClick={toggleFullscreen}
                className={`p-1.5 rounded-xs transition-colors cursor-pointer ${isFullscreen ? 'hover:bg-slate-700 text-slate-300' : 'hover:bg-white text-slate-600 hover:text-slate-900'
                  }`}
                title={isFullscreen ? 'ย่อหน้าต่างกลับสู่ขนาดปกติ' : 'ขยายอ่านเต็มหน้าจอ'}
              >
                {isFullscreen ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
              </button>
            </div>

            {/* Pink Download Action Button */}
            <button
              type="button"
              onClick={handleDownload}
              disabled={downloading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-sm text-xs font-bold bg-gradient-to-r from-pink-500 to-pink-600 hover:from-pink-600 hover:to-pink-700 text-white shadow-xs transition-colors cursor-pointer disabled:opacity-50 shrink-0"
              title="ดาวน์โหลดไฟล์คู่มือมาตรฐาน"
            >
              <Download size={13} className={downloading ? 'animate-bounce' : ''} />
              <span className="hidden sm:inline">{downloading ? 'กำลังดาวน์โหลด...' : 'ดาวน์โหลด'}</span>
            </button>
          </div>
        </CardHeader>

        {/* ── Continuous Scroll Viewport: Isolated Mouse Wheel & OverScroll Contain ── */}
        <CardContent
          ref={scrollContainerRef}
          className={`p-4 md:p-6 relative flex-1 min-h-0 overflow-y-auto overflow-x-auto flex flex-col items-center select-none overscroll-contain ${isFullscreen ? 'bg-slate-950' : 'bg-slate-100/90'
            }`}
          style={{
            overscrollBehavior: 'contain',
          }}
        >
          {loadingPdf ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-400 py-24 my-auto">
              <RefreshCw size={26} className="animate-spin text-blue-900 mb-2.5" />
              <span className="text-xs font-semibold text-slate-700">กำลังเปิดไฟล์คู่มือมาตรฐาน...</span>
              <span className="text-[11px] text-slate-400 mt-0.5">ระบบกำลังเตรียมหน้าเอกสารสำหรับแสดงผลในเบราว์เซอร์</span>
            </div>
          ) : loadError ? (
            <div className="flex flex-col items-center justify-center h-full text-rose-500 py-24 my-auto text-center">
              <span className="text-sm font-semibold">{loadError}</span>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="mt-3 px-3 py-1.5 rounded-sm bg-blue-900 text-white text-xs font-medium hover:bg-blue-800 transition-colors cursor-pointer"
              >
                ลองใหม่อีกครั้ง
              </button>
            </div>
          ) : pdfDoc ? (
            <div className="w-full flex flex-col items-center py-2">
              {Array.from({ length: numPages }, (_, i) => i + 1).map((pageNum) => (
                <PdfPageItem
                  key={pageNum}
                  pageNum={pageNum}
                  pdfDoc={pdfDoc}
                  zoomScale={zoomScale}
                  rotation={rotation}
                  scrollContainerRef={scrollContainerRef}
                  onIntersect={handleActivePageIntersect}
                />
              ))}
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
