import React from 'react';

/**
 * UserAvatar — a self-contained, illustrative 3D-style profile avatar (no external
 * asset). A glossy gradient sphere with a friendly character: styled hair, a face,
 * and a collared blazer, framed by a thin light ring so it reads on light + dark
 * rails. NON-SHIPPED demo.
 */
export const UserAvatar: React.FC<{ size?: number; className?: string }> = ({
  size = 40,
  className = '',
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 96 96"
    fill="none"
    role="img"
    aria-label="Profile"
    className={className}
    style={{ display: 'block' }}
  >
    <defs>
      <linearGradient id="ua-bg" x1="14" y1="6" x2="82" y2="94" gradientUnits="userSpaceOnUse">
        <stop stopColor="#5285E6" />
        <stop offset="0.5" stopColor="#2A55AC" />
        <stop offset="1" stopColor="#112F66" />
      </linearGradient>
      <radialGradient
        id="ua-vig"
        cx="0"
        cy="0"
        r="1"
        gradientUnits="userSpaceOnUse"
        gradientTransform="translate(48 48) scale(48)"
      >
        <stop offset="0.62" stopColor="#04102E" stopOpacity="0" />
        <stop offset="1" stopColor="#04102E" stopOpacity="0.4" />
      </radialGradient>
      <linearGradient id="ua-blazer" x1="48" y1="66" x2="48" y2="98" gradientUnits="userSpaceOnUse">
        <stop stopColor="#2E3E5C" />
        <stop offset="1" stopColor="#1A2740" />
      </linearGradient>
      <linearGradient id="ua-skin" x1="36" y1="28" x2="60" y2="64" gradientUnits="userSpaceOnUse">
        <stop stopColor="#FCD9B8" />
        <stop offset="1" stopColor="#E7AD80" />
      </linearGradient>
      <linearGradient id="ua-hair" x1="32" y1="20" x2="64" y2="50" gradientUnits="userSpaceOnUse">
        <stop stopColor="#4E3C2D" />
        <stop offset="1" stopColor="#271C13" />
      </linearGradient>
      <radialGradient
        id="ua-gloss"
        cx="0"
        cy="0"
        r="1"
        gradientUnits="userSpaceOnUse"
        gradientTransform="translate(31 26) rotate(52) scale(56)"
      >
        <stop stopColor="#FFFFFF" stopOpacity="0.42" />
        <stop offset="0.55" stopColor="#FFFFFF" stopOpacity="0" />
      </radialGradient>
      <clipPath id="ua-clip">
        <circle cx="48" cy="48" r="48" />
      </clipPath>
    </defs>
    <g clipPath="url(#ua-clip)">
      <rect width="96" height="96" fill="url(#ua-bg)" />
      {/* shoulders / blazer */}
      <path d="M8 98 C8 78 26 68 48 68 C70 68 88 78 88 98 Z" fill="url(#ua-blazer)" />
      {/* light shirt V */}
      <path d="M41 68 L48 83 L55 68 L51 66.5 L48 70 L45 66.5 Z" fill="#ECE7DC" />
      {/* blazer lapels over the shirt */}
      <path d="M41 68 L34 92 L46 75 Z" fill="#26344C" />
      <path d="M55 68 L62 92 L50 75 Z" fill="#26344C" />
      {/* neck + under-jaw shadow */}
      <path d="M42.5 55 L42.5 67 C42.5 70 53.5 70 53.5 67 L53.5 55 Z" fill="#E7AE80" />
      <path d="M42.5 55 L42.5 60 C45 64 51 64 53.5 60 L53.5 55 Z" fill="#C98A5C" opacity="0.45" />
      {/* ears */}
      <ellipse cx="33.6" cy="45" rx="2.8" ry="4.4" fill="#EEBE8F" />
      <ellipse cx="62.4" cy="45" rx="2.8" ry="4.4" fill="#EEBE8F" />
      {/* head */}
      <ellipse cx="48" cy="43" rx="15" ry="16.5" fill="url(#ua-skin)" />
      {/* soft jaw shading */}
      <path d="M35 47 C38 57 58 57 61 47 C60 55 53 60 48 60 C43 60 36 55 35 47 Z" fill="#D9966A" opacity="0.26" />
      {/* cheeks */}
      <ellipse cx="39.5" cy="48" rx="2.6" ry="1.8" fill="#F2A877" opacity="0.45" />
      <ellipse cx="56.5" cy="48" rx="2.6" ry="1.8" fill="#F2A877" opacity="0.45" />
      {/* eyebrows */}
      <path d="M39.6 39.4 Q43 38 46.2 39.3" stroke="#3A2A1E" strokeWidth="1.5" strokeLinecap="round" fill="none" />
      <path d="M49.8 39.3 Q53 38 56.4 39.4" stroke="#3A2A1E" strokeWidth="1.5" strokeLinecap="round" fill="none" />
      {/* eyes */}
      <ellipse cx="42.8" cy="43.4" rx="1.7" ry="2.3" fill="#33271C" />
      <ellipse cx="53.2" cy="43.4" rx="1.7" ry="2.3" fill="#33271C" />
      <circle cx="43.4" cy="42.6" r="0.55" fill="#FFFFFF" opacity="0.9" />
      <circle cx="53.8" cy="42.6" r="0.55" fill="#FFFFFF" opacity="0.9" />
      {/* nose */}
      <path d="M48 44.4 L46.3 48.2 Q48 49.2 49.7 48.2 Z" fill="#D2905F" opacity="0.5" />
      {/* smile */}
      <path d="M43.4 51 Q48 54.2 52.6 51" stroke="#A85E3D" strokeWidth="1.6" strokeLinecap="round" fill="none" />
      {/* hair */}
      <path
        d="M32 47 C31 30.5 39.5 23.5 48 23.5 C56.5 23.5 65 30.5 64 47 C63 42 60 38.5 56.5 36.8 C54.5 35.3 51 34.4 48 34.4 C45 34.4 41.5 35.3 39.5 36.8 C36 38.5 33 42 32 47 Z"
        fill="url(#ua-hair)"
      />
      {/* hair highlight */}
      <path d="M45.5 25 C40 26.4 36 30.8 34.4 37 C37.8 31.6 42 28.6 46.6 27.6 Z" fill="#6A5340" opacity="0.55" />
      {/* sphere gloss + vignette */}
      <rect width="96" height="96" fill="url(#ua-gloss)" />
      <rect width="96" height="96" fill="url(#ua-vig)" />
    </g>
    <circle cx="48" cy="48" r="46.6" stroke="#FFFFFF" strokeOpacity="0.6" strokeWidth="2.4" />
  </svg>
);

export default UserAvatar;
