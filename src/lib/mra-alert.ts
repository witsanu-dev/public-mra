/**
 * mra-alert.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Branded SweetAlert2 instance for MRA System.
 * Theme: Standard Navy (#0f172a) primary, Rose (#e11d48) danger, Slate accents.
 * Design: Standard rounded-sm, comfortable margin/padding, separated buttons.
 * Redundant buttons: Deny ("No") button is strictly disabled across all dialogs.
 * Font: Anuphan (inherited from CSS).
 * ─────────────────────────────────────────────────────────────────────────────
 */
import Swal from 'sweetalert2';

/* ── Base customClass tokens ── */
export const baseCustomClass = {
  popup:          'mra-swal-popup',
  title:          'mra-swal-title',
  htmlContainer:  'mra-swal-body',
  confirmButton:  'mra-swal-btn-confirm',
  cancelButton:   'mra-swal-btn-cancel',
  icon:           'mra-swal-icon',
  actions:        'mra-swal-actions',
  footer:         'mra-swal-footer',
};

/* ── 1. Base instance with system-wide defaults ────────────────────────────── */
const MraAlert = Swal.mixin({
  customClass: baseCustomClass,
  buttonsStyling: false,      // Use CSS classes instead of SweetAlert2 inline styles
  showDenyButton: false,      // Strictly disable redundant "No" button
  showClass: {
    popup:    'mra-swal-show',
    backdrop: 'mra-swal-backdrop-show',
  },
  hideClass: {
    popup:    'mra-swal-hide',
    backdrop: 'mra-swal-backdrop-hide',
  },
  allowOutsideClick: false,
  allowEscapeKey: true,
  scrollbarPadding: false,
});

/* ── 1.1 Toast instance (without incompatible modal params) ─────────────────── */
const MraToast = Swal.mixin({
  toast: true,
  position: 'bottom-end',
  buttonsStyling: false,
  showConfirmButton: false,
  showDenyButton: false,
  showCancelButton: false,
  scrollbarPadding: false,
});

/* ── 2. Pre-configured dialog helpers ──────────────────────────────────────── */

/** Confirm dialog with rounded-sm buttons and standard spacing (Only Confirm + Cancel) */
export async function alertConfirm({
  title,
  text,
  confirmText = 'ยืนยัน',
  cancelText  = 'ยกเลิก',
  icon        = 'warning',
  danger      = false,
}: {
  title:        string;
  text?:        string;
  confirmText?: string;
  cancelText?:  string;
  icon?:        'warning' | 'question' | 'info';
  danger?:      boolean;   // red confirm button variant
}): Promise<boolean> {
  const result = await MraAlert.fire({
    icon,
    title,
    html: text
      ? `<p class="mra-swal-text">${text}</p>`
      : undefined,
    showCancelButton: true,
    showDenyButton: false,
    confirmButtonText: confirmText,
    cancelButtonText:  cancelText,
    reverseButtons: true,
    customClass: {
      ...baseCustomClass,
      confirmButton: danger ? 'mra-swal-btn-danger' : 'mra-swal-btn-confirm',
      cancelButton:  'mra-swal-btn-cancel',
    },
  });
  return result.isConfirmed;
}

type AlertParam = string | { title: string; text?: string };

function parseAlertParams(param: AlertParam, extraText?: string): { title: string; text?: string } {
  if (typeof param === 'string') {
    return { title: param, text: extraText };
  }
  return { title: param.title, text: param.text || extraText };
}

/** Success toast — auto-dismiss bottom-end */
export function alertSuccess(titleOrOpts: AlertParam, text?: string) {
  const { title, text: bodyText } = parseAlertParams(titleOrOpts, text);
  return MraToast.fire({
    icon: 'success',
    title,
    html: bodyText ? `<p class="mra-swal-text">${bodyText}</p>` : undefined,
    timer: 3000,
    timerProgressBar: true,
  });
}

/** Error toast — stays until dismissed */
export function alertError(titleOrOpts: AlertParam, text?: string) {
  const { title, text: bodyText } = parseAlertParams(titleOrOpts, text);
  return MraToast.fire({
    icon: 'error',
    title,
    html: bodyText ? `<p class="mra-swal-text">${bodyText}</p>` : undefined,
    showCloseButton: true,
  });
}

/** Info toast */
export function alertInfo(titleOrOpts: AlertParam, text?: string) {
  const { title, text: bodyText } = parseAlertParams(titleOrOpts, text);
  return MraToast.fire({
    icon: 'info',
    title,
    html: bodyText ? `<p class="mra-swal-text">${bodyText}</p>` : undefined,
    timer: 4000,
    timerProgressBar: true,
  });
}

/** Warning dialog with single OK button */
export function alertWarning(titleOrOpts: AlertParam, text?: string) {
  const { title, text: bodyText } = parseAlertParams(titleOrOpts, text);
  return MraAlert.fire({
    icon: 'warning',
    title,
    html: bodyText ? `<p class="mra-swal-text">${bodyText}</p>` : undefined,
    confirmButtonText: 'ตกลง',
    showDenyButton: false,
    showCancelButton: false,
    customClass: baseCustomClass,
  });
}

/** Loading overlay — call .close() on the returned instance to dismiss */
export function alertLoading(title = 'กำลังดำเนินการ...', text?: string) {
  return MraAlert.fire({
    title,
    html: text ? `<p class="mra-swal-text">${text}</p>` : undefined,
    allowOutsideClick: false,
    allowEscapeKey:    false,
    showConfirmButton: false,
    showDenyButton: false,
    showCancelButton: false,
    didOpen: () => Swal.showLoading(),
  });
}

/** Generic input prompt — returns string | null */
export async function alertInput({
  title,
  placeholder = '',
  defaultValue = '',
  confirmText = 'ยืนยัน',
}: {
  title:         string;
  placeholder?:  string;
  defaultValue?: string;
  confirmText?:  string;
}): Promise<string | null> {
  const result = await MraAlert.fire({
    icon: 'question',
    title,
    input: 'text',
    inputPlaceholder: placeholder,
    inputValue: defaultValue,
    showCancelButton: true,
    showDenyButton: false,
    confirmButtonText: confirmText,
    cancelButtonText: 'ยกเลิก',
    reverseButtons: true,
    inputAttributes: { autocomplete: 'off' },
    customClass: {
      ...baseCustomClass,
      input:         'mra-swal-input',
      confirmButton: 'mra-swal-btn-confirm',
      cancelButton:  'mra-swal-btn-cancel',
    },
  });
  return result.isConfirmed ? (result.value as string) : null;
}

export { MraAlert };
export default MraAlert;
