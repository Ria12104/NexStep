// =============================================================================
// NexStep — UI: Toast Notifications
// Shared utility — imported by all UI modules.
// =============================================================================

/**
 * Display a toast message.
 * @param {string} msg
 * @param {'success'|'warning'|'error'} type
 */
export function showToast(msg, type = 'success') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = msg;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.transition = 'opacity 0.3s, transform 0.3s';
    toast.style.opacity    = '0';
    toast.style.transform  = 'translateY(8px)';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}
