import React, { useState } from 'react';
import { AlertCircle, X } from 'lucide-react';

interface ReasonModalProps {
  isOpen: boolean;
  title: string;
  description?: string;
  placeholder?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  minChars?: number;
  isDestructive?: boolean;
  onConfirm: (motif: string) => Promise<void> | void;
  onClose: () => void;
}

export const ReasonModal: React.FC<ReasonModalProps> = ({
  isOpen,
  title,
  description,
  placeholder = 'Exprimez clairement la justification de cette opération...',
  confirmLabel = 'Confirmer et tracer',
  cancelLabel = 'Annuler',
  minChars = 10,
  isDestructive = false,
  onConfirm,
  onClose,
}) => {
  const [motif, setMotif] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const isValid = motif.trim().length >= minChars;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid || loading) return;

    try {
      setLoading(true);
      setError(null);
      await onConfirm(motif.trim());
      setMotif('');
      onClose();
    } catch (err: any) {
      setError(err.message || 'Une erreur est survenue lors de l enregistrement.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-2xl transition-all border border-isieco-border">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-isieco-border pb-3">
          <h3 className="text-lg font-bold text-isieco-dark">{title}</h3>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-isieco-muted hover:bg-gray-100 hover:text-isieco-dark"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {description && (
            <p className="text-sm text-isieco-muted leading-relaxed">{description}</p>
          )}

          {error && (
            <div className="flex items-center gap-2 rounded-lg bg-rose-50 p-3 text-sm text-rose-700 border border-rose-200">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-isieco-muted mb-1">
              Motif explicite obligatoire <span className="text-rose-500">*</span>
            </label>
            <textarea
              rows={4}
              value={motif}
              onChange={(e) => setMotif(e.target.value)}
              placeholder={placeholder}
              className="w-full rounded-lg border border-isieco-border p-3 text-sm focus:border-isieco-primary focus:outline-none focus:ring-2 focus:ring-isieco-primary/20"
              autoFocus
            />
            <div className="mt-1 flex justify-between text-xs text-isieco-muted">
              <span>{minChars} caractères minimum requis (Règle d intégrité d audit)</span>
              <span className={motif.trim().length >= minChars ? 'text-emerald-600 font-semibold' : 'text-rose-600'}>
                {motif.trim().length} / {minChars}
              </span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-3 border-t border-isieco-border">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="rounded-lg border border-isieco-border px-4 py-2 text-sm font-medium text-isieco-dark hover:bg-gray-50"
            >
              {cancelLabel}
            </button>
            <button
              type="submit"
              disabled={!isValid || loading}
              className={`rounded-lg px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors ${
                !isValid || loading
                  ? 'bg-gray-300 cursor-not-allowed'
                  : isDestructive
                  ? 'bg-rose-600 hover:bg-rose-700'
                  : 'bg-isieco-primary hover:bg-isieco-primary-dark'
              }`}
            >
              {loading ? 'Enregistrement...' : confirmLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

