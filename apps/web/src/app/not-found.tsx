import Link from 'next/link';
import { Compass, ArrowLeft } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
      <div className="p-8 rounded-3xl glass-panel border border-slate-200/80 dark:border-white/10 max-w-md w-full space-y-4 shadow-xl">
        <div className="w-14 h-14 rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-400 mx-auto flex items-center justify-center">
          <Compass className="w-7 h-7" />
        </div>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Page Not Found</h2>
        <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
          The requested page or resource could not be found in the knowledge library.
        </p>
        <div className="pt-2">
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl text-sm transition-colors shadow-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Search</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
