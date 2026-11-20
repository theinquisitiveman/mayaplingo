/** "Parul" — a parol, the star lantern San Fernando, Pampanga is famous for; the app's mascot. */
const STAR = '50,6 61,38 95,38 67,58 78,92 50,71 22,92 33,58 5,38 39,38'

export function Mascot({ size = 96, mood = 'happy' }: { size?: number; mood?: 'happy' | 'sad' | 'cheer' }) {
  const mouth = mood === 'sad' ? 'M42 66 q8 -6 16 0' : mood === 'cheer' ? 'M39 59 q11 13 22 0 z' : 'M41 61 q9 8 18 0'
  return (
    <svg width={size} height={size * 1.3} viewBox="0 0 100 130" aria-hidden>
      <circle cx="50" cy="52" r="47" fill="#ffc800" opacity=".18" />
      <polygon points={STAR} fill="#ffc800" stroke="#e5a400" strokeWidth="4" strokeLinejoin="round" />
      <polygon points="50,22 56,40 74,40 60,51 65,69 50,58 35,69 40,51 26,40 44,40" fill="#ff4b4b" opacity=".85" />
      <circle cx="42" cy="48" r="5" fill="#fff" /><circle cx="58" cy="48" r="5" fill="#fff" />
      <circle cx="43" cy="49" r="2.5" fill="#4b4b4b" /><circle cx="59" cy="49" r="2.5" fill="#4b4b4b" />
      <path d={mouth} fill={mood === 'cheer' ? '#4b4b4b' : 'none'} stroke="#4b4b4b" strokeWidth="3" strokeLinecap="round" />
      <path d="M22 92 q-4 14 2 26 M78 92 q4 14 -2 26 M50 71 q0 22 0 44" fill="none" stroke="#1cb0f6" strokeWidth="3" strokeLinecap="round" />
      <circle cx="24" cy="120" r="4" fill="#58cc02" /><circle cx="76" cy="120" r="4" fill="#58cc02" /><circle cx="50" cy="118" r="4" fill="#ce82ff" />
    </svg>
  )
}
