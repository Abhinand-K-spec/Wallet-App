'use client';

import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import type { RootState } from '../store/store';
import { removeToast } from '../store/toastSlice';
import type { Toast } from '../store/toastSlice';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

const ToastItem = ({ toast, onClose }: { toast: Toast; onClose: (id: string) => void }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose(toast.id);
    }, 4000);
    return () => clearTimeout(timer);
  }, [toast.id, onClose]);

  const styles = {
    success: 'bg-emerald-950/90 border-emerald-500/40 text-emerald-300',
    error: 'bg-red-950/90 border-red-500/40 text-red-300',
    info: 'bg-indigo-950/90 border-indigo-500/40 text-indigo-300',
  };

  const icons = {
    success: <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />,
    error: <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />,
    info: <Info className="w-5 h-5 text-indigo-400 shrink-0" />,
  };

  return (
    <div className={`pointer-events-auto flex items-start gap-3 p-4 rounded-xl border backdrop-blur-md shadow-2xl transition-all duration-300 animate-slide-in ${styles[toast.type]}`}>
      {icons[toast.type]}
      <div className="flex-1 text-sm font-medium pr-2 break-words">
        {toast.message}
      </div>
      <button 
        onClick={() => onClose(toast.id)} 
        className="text-gray-400 hover:text-white transition-colors shrink-0 mt-0.5 cursor-pointer"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};

export const ToastContainer = () => {
  const { toasts } = useSelector((state: RootState) => state.toast);
  const dispatch = useDispatch();

  return (
    <div className="fixed top-4 right-4 z-50 space-y-3 max-w-sm w-full pointer-events-none px-4 sm:px-0">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onClose={(id) => dispatch(removeToast(id))} />
      ))}
    </div>
  );
};

export default ToastContainer;
