import Image from 'next/image';

/** Just the OmniWealth logo tile (no wordmark), for cards that carry their own title. */
export default function BrandMark({ size = 44 }: { size?: number }) {
  return (
    <div
      className="relative rounded-xl overflow-hidden border border-slate-800 bg-slate-900 shrink-0 shadow-lg shadow-teal-900/30"
      style={{ width: size, height: size }}
    >
      <Image src="/omniwealth.jpg" alt="OmniWealth" width={size} height={size} className="object-cover w-full h-full" />
    </div>
  );
}
