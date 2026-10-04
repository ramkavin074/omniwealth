import Link from 'next/link';
import Image from 'next/image';

/**
 * The OmniWealth logo + wordmark (+ optional household line) used in every
 * page header, so size, weight and wording are identical across pages.
 * `tone="dark"` is for the always-dark landing page; the default follows the
 * app theme. `size="sm"` is for the slide-out phone menus.
 */
export default function BrandLink({
  subtitle,
  href = '/',
  onClick,
  size = 'md',
  tone = 'app',
  className = '',
}: {
  subtitle?: string;
  href?: string;
  onClick?: () => void;
  size?: 'md' | 'sm';
  tone?: 'app' | 'dark';
  className?: string;
}) {
  const dark = tone === 'dark';
  const logoBox =
    size === 'sm'
      ? 'w-8 h-8'
      : 'w-9 h-9 sm:w-10 sm:h-10';
  const logoPx = size === 'sm' ? 32 : 40;
  const titleCls =
    size === 'sm'
      ? 'font-bold text-xs tracking-tight'
      : 'font-extrabold text-sm sm:text-base md:text-lg tracking-tight';

  return (
    <Link href={href} onClick={onClick} className={`flex items-center gap-2.5 min-w-0 ${className}`}>
      <div
        className={`relative ${logoBox} rounded-xl overflow-hidden border shrink-0 flex items-center justify-center shadow-sm ${
          dark
            ? 'border-slate-800 bg-slate-900'
            : 'border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800'
        }`}
      >
        <Image src="/omniwealth.jpg" alt="OmniWealth" width={logoPx} height={logoPx} className="object-cover w-full h-full" />
      </div>
      <div className="min-w-0 flex-1 leading-tight">
        <div className={`${titleCls} truncate ${dark ? 'text-white' : 'text-slate-900 dark:text-white'}`}>OmniWealth</div>
        {subtitle && (
          <div
            className={`text-[10px] sm:text-xs uppercase tracking-wider font-semibold font-mono truncate ${
              dark ? 'text-teal-400' : 'text-teal-700 dark:text-teal-400'
            }`}
          >
            {subtitle}
          </div>
        )}
      </div>
    </Link>
  );
}
