import React from 'react';

interface StatusBadgeProps {
  status: string;
  size?: 'sm' | 'md';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, size = 'md' }) => {
  const getBadgeStyle = (st: string) => {
    switch (st) {
      // Signalement
      case 'SOUMIS':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'EN_COURS_DE_QUALIFICATION':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'ACCEPTE_POUR_RATTACHEMENT':
        return 'bg-indigo-100 text-indigo-800 border-indigo-200';
      case 'RATTACHE':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'REJETE':
        return 'bg-rose-100 text-rose-800 border-rose-200';

      // Dossier
      case 'A_QUALIFIER':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'EN_ATTENTE_AFFECTATION':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'EN_COURS_DE_TRAITEMENT':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'CLOS_RESOLUTION_CONFIRMEE':
        return 'bg-emerald-100 text-emerald-800 border-emerald-300';
      case 'CLOS_SANS_SUITE':
        return 'bg-gray-100 text-gray-800 border-gray-300';

      // Volet / Contenu Dossier
      case 'INCLUSE':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'RETIRE':
        return 'bg-gray-200 text-gray-700 border-gray-300 line-through';

      // Affectation & Intervention
      case 'ACTIVE':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'PROGRAMMEE':
        return 'bg-slate-100 text-slate-800 border-slate-200';
      case 'EN_COURS':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'TERMINEE':
        return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'REMPLACEE':
        return 'bg-gray-100 text-gray-600 border-gray-200';

      // Résultat Vérification
      case 'CONFORME_RESOLU':
        return 'bg-emerald-100 text-emerald-800 border-emerald-300 font-semibold';
      case 'PARTIEL_NON_RESOLU':
        return 'bg-amber-100 text-amber-800 border-amber-300';
      case 'NON_CONFORME':
        return 'bg-rose-100 text-rose-800 border-rose-300';

      // Priorités
      case 'URGENTE':
        return 'bg-rose-600 text-white border-rose-700 font-bold';
      case 'ELEVEE':
        return 'bg-orange-500 text-white border-orange-600';
      case 'MOYENNE':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'FAIBLE':
        return 'bg-gray-100 text-gray-700 border-gray-200';

      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const formatLabel = (st: string) => {
    return st.replace(/_/g, ' ');
  };

  const sizeClasses = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs font-medium';

  return (
    <span
      className={`inline-flex items-center rounded-full border ${sizeClasses} ${getBadgeStyle(status)} uppercase tracking-wider`}
    >
      {formatLabel(status)}
    </span>
  );
};

