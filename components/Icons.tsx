import React from 'react';

const SVGIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  />
);

export const MenuIcon: React.FC<{ className?: string }> = ({ className }) => (
    <SVGIcon className={className}>
        <line x1="3" y1="12" x2="21" y2="12"></line>
        <line x1="3" y1="6" x2="21" y2="6"></line>
        <line x1="3" y1="18" x2="21" y2="18"></line>
    </SVGIcon>
);

export const AiScanIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg viewBox="0 0 100 100" className={className} xmlns="http://www.w3.org/2000/svg">
        <defs>
            <linearGradient id="neutral-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#A0AEC0"/>
                <stop offset="100%" stopColor="#718096"/>
            </linearGradient>
        </defs>
        
        {/* Car silhouette */}
        <path d="M85 50 H78 C75 44, 68 42, 62 42 H38 C32 42, 25 44, 22 50 H15 C13 50, 11 52, 11 54 V62 H15" fill="none" stroke="url(#neutral-grad)" strokeWidth="3"/>
        <path d="M15 62 C18 68, 25 70, 30 70 H70 C75 70, 82 68, 85 62 H89 V54 C89 52, 87 50, 85 50" fill="none" stroke="url(#neutral-grad)" strokeWidth="3"/>
        <path d="M28 42 Q32 35, 40 35 H60 Q68 35, 72 42" fill="none" stroke="url(#neutral-grad)" strokeWidth="2.5"/>

        {/* Scanner/Target elements */}
        <circle cx="50" cy="55" r="28" stroke="currentColor" strokeWidth="1.5" strokeDasharray="4 4" opacity="0.6"/>
        <path d="M50 27 V35 M50 75 V83 M22 55 H30 M70 55 H78" stroke="currentColor" strokeWidth="1.5" opacity="0.6"/>
        
        {/* Highlight line */}
        <path d="M25 55 H75" stroke="currentColor" strokeWidth="2.5" opacity="0.9"/>
    </svg>
);


export const UploadIcon: React.FC<{ className?: string }> = ({ className }) => (
  <SVGIcon className={className}>
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="17 8 12 3 7 8" />
    <line x1="12" y1="3" x2="12" y2="15" />
  </SVGIcon>
);

export const CarIcon: React.FC<{ className?: string }> = ({ className }) => (
    <SVGIcon className={className}>
        <path d="M14 16.5V15a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v1.5" />
        <path d="M20 10h-2.1a2 2 0 0 0-1.8.9L15 13H9.86a2 2 0 0 0-1.8.9L7 15H4a2 2 0 0 0-2 2v2.65a.35.35 0 0 0 .35.35H5a2 2 0 0 0 2-2v-1.15" />
        <path d="M6 10H4" />
        <path d="M18 10h2" />
        <path d="M15 5l-2.4-2.4A2 2 0 0 0 11.17 2H8.83a2 2 0 0 0-1.41.59L5 5" />
        <path d="M5 10l1.1-1.1A2 2 0 0 1 7.5 8H12" />
        <circle cx="7" cy="18" r="2" />
        <circle cx="17" cy="18" r="2" />
    </SVGIcon>
);

export const SolidCarIcon: React.FC<{ className?: string }> = ({ className }) => (
    <SVGIcon className={className} fill="currentColor">
        <path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z"/>
    </SVGIcon>
);

export const SolidCameraIcon: React.FC<{ className?: string }> = ({ className }) => (
    <SVGIcon className={className} fill="currentColor" stroke="none" strokeWidth={1}>
        <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
        <circle cx="12" cy="13" r="3" fill="currentColor" />
    </SVGIcon>
);

export const StartScanCameraIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        className={className}
        fill="none"
        stroke="none"
    >
        <path fill="currentColor" className="text-dark-primary" d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"></path>
        <circle fill="currentColor" className="text-white" cx="12" cy="13" r="3"></circle>
    </svg>
);

export const AlertTriangleIcon: React.FC<{ className?: string }> = ({ className }) => (
  <SVGIcon className={className}>
    <path d="m21.73 18-8-14a2 2 0 0 0-3.46 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
    <line x1="12" y1="9" x2="12" y2="13" />
    <line x1="12" y1="17" x2="12.01" y2="17" />
  </SVGIcon>
);

export const CheckCircleIcon: React.FC<{ className?: string }> = ({ className }) => (
  <SVGIcon className={className}>
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
    <polyline points="22 4 12 14.01 9 11.01" />
  </SVGIcon>
);

export const PlusCircleIcon: React.FC<{ className?: string }> = ({ className }) => (
  <SVGIcon className={className}>
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="8" x2="12" y2="16" />
    <line x1="8" y1="12" x2="16" y2="12" />
  </SVGIcon>
);

export const InfoIcon: React.FC<{ className?: string }> = ({ className }) => (
  <SVGIcon className={className}>
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="16" x2="12" y2="12" />
    <line x1="12" y1="8" x2="12.01" y2="8" />
  </SVGIcon>
);

export const XIcon: React.FC<{ className?: string }> = ({ className }) => (
    <SVGIcon className={className}>
        <line x1="18" y1="6" x2="6" y2="18"></line>
        <line x1="6" y1="6" x2="18" y2="18"></line>
    </SVGIcon>
);

export const AiEstimateIcon: React.FC<{ className?: string }> = ({ className }) => (
    <SVGIcon className={className}>
        <path d="M19 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2z"/>
        <path d="M9.5 16.5l-1.5-3.5-3.5-1.5 3.5-1.5 1.5-3.5 1.5 3.5 3.5 1.5-3.5 1.5-1.5 3.5z" fill="currentColor"/>
        <path d="m16.5 10.5-1-2.5-2.5-1 2.5-1 1-2.5 1 2.5 2.5 1-2.5 1-1 2.5z" fill="currentColor"/>
    </SVGIcon>
);

export const GaugeIcon: React.FC<{ className?: string }> = ({ className }) => (
  <SVGIcon className={className}>
    <path d="m12 14 4-4" />
    <path d="M3.34 19a10 10 0 1 1 17.32 0" />
  </SVGIcon>
);

export const DollarSignIcon: React.FC<{ className?: string }> = ({ className }) => (
  <SVGIcon className={className}>
    <line x1="12" y1="1" x2="12" y2="23" />
    <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
  </SVGIcon>
);

export const CalendarIcon: React.FC<{ className?: string }> = ({ className }) => (
  <SVGIcon className={className}>
    <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
    <line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
  </SVGIcon>
);

export const MessageSquareIcon: React.FC<{ className?: string }> = ({ className }) => (
  <SVGIcon className={className}>
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </SVGIcon>
);

export const SearchIcon: React.FC<{ className?: string }> = ({ className }) => (
  <SVGIcon className={className}>
    <circle cx="11" cy="11" r="8" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
  </SVGIcon>
);

export const ZoomInIcon: React.FC<{ className?: string }> = ({ className }) => (
  <SVGIcon className={className}>
    <circle cx="11" cy="11" r="8" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
    <line x1="11" y1="8" x2="11" y2="14" />
    <line x1="8" y1="11" x2="14" y2="11" />
  </SVGIcon>
);

export const ZoomOutIcon: React.FC<{ className?: string }> = ({ className }) => (
  <SVGIcon className={className}>
    <circle cx="11" cy="11" r="8" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
    <line x1="8" y1="11" x2="14" y2="11" />
  </SVGIcon>
);

export const CameraIcon: React.FC<{ className?: string }> = ({ className }) => (
  <SVGIcon className={className}>
    <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
    <circle cx="12" cy="13" r="3" />
  </SVGIcon>
);

export const SunIcon: React.FC<{ className?: string }> = ({ className }) => (
  <SVGIcon className={className}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2" />
    <path d="M12 20v2" />
    <path d="m4.93 4.93 1.41 1.41" />
    <path d="m17.66 17.66 1.41 1.41" />
    <path d="M2 12h2" />
    <path d="M20 12h2" />
    <path d="m4.93 17.66 1.41-1.41" />
    <path d="m17.66 4.93 1.41-1.41" />
  </SVGIcon>
);

export const LayersIcon: React.FC<{ className?: string }> = ({ className }) => (
  <SVGIcon className={className}>
    <polygon points="12 2 2 7 12 12 22 7 12 2" />
    <polyline points="2 17 12 22 22 17" />
    <polyline points="2 12 12 17 22 12" />
  </SVGIcon>
);

export const ViewfinderIcon: React.FC<{ className?: string }> = ({ className }) => (
    <SVGIcon className={className}>
      <path d="M3 7V3h4" />
      <path d="M21 7V3h-4" />
      <path d="M3 17v4h4" />
      <path d="M21 17v4h-4" />
    </SVGIcon>
);

export const ChevronDownIcon: React.FC<{ className?: string }> = ({ className }) => (
    <SVGIcon className={className}>
        <polyline points="6 9 12 15 18 9"></polyline>
    </SVGIcon>
);

export const UserIcon: React.FC<{ className?: string }> = ({ className }) => (
  <SVGIcon className={className}>
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </SVGIcon>
);

export const MailIcon: React.FC<{ className?: string }> = ({ className }) => (
  <SVGIcon className={className}>
    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
    <polyline points="22,6 12,13 2,6" />
  </SVGIcon>
);

export const PhoneIcon: React.FC<{ className?: string }> = ({ className }) => (
  <SVGIcon className={className}>
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
  </SVGIcon>
);

export const MapPinIcon: React.FC<{ className?: string }> = ({ className }) => (
  <SVGIcon className={className}>
    <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
    <circle cx="12" cy="10" r="3" />
  </SVGIcon>
);

export const GridIcon: React.FC<{ className?: string }> = ({ className }) => (
  <SVGIcon className={className}>
    <rect x="3" y="3" width="7" height="7" />
    <rect x="14" y="3" width="7" height="7" />
    <rect x="3" y="14" width="7" height="7" />
    <rect x="14" y="14" width="7" height="7" />
  </SVGIcon>
);

export const StarIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
    <SVGIcon {...props} fill={props.fill || "currentColor"}>
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </SVGIcon>
);
  
export const GlobeIcon: React.FC<{ className?: string }> = ({ className }) => (
      <SVGIcon className={className}>
          <circle cx="12" cy="12" r="10" />
          <line x1="2" y1="12" x2="22" y2="12" />
          <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
      </SVGIcon>
);

export const SendIcon: React.FC<{ className?: string }> = ({ className }) => (
    <SVGIcon className={className}>
        <line x1="22" y1="2" x2="11" y2="13"></line>
        <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
    </SVGIcon>
);

export const SettingsIcon: React.FC<{ className?: string }> = ({ className }) => (
    <SVGIcon className={className}>
        <circle cx="12" cy="12" r="3"></circle>
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V15a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
    </SVGIcon>
);

export const KeyIcon: React.FC<{ className?: string }> = ({ className }) => (
    <SVGIcon className={className}>
        <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
    </SVGIcon>
);

export const FileTextIcon: React.FC<{ className?: string }> = ({ className }) => (
    <SVGIcon className={className}>
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
        <polyline points="10 9 9 9 8 9" />
    </SVGIcon>
);

export const SaveIcon: React.FC<{ className?: string }> = ({ className }) => (
    <SVGIcon className={className}>
        <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
        <polyline points="17 21 17 13 7 13 7 21" />
        <polyline points="7 3 7 8 15 8" />
    </SVGIcon>
);

export const RotateCcwIcon: React.FC<{ className?: string }> = ({ className }) => (
    <SVGIcon className={className}>
        <path d="M3 2v6h6" />
        <path d="M3 13a9 9 0 1 0 3-7.7L3 8" />
    </SVGIcon>
);

export const ThumbsUpIcon: React.FC<{ className?: string }> = ({ className }) => (
  <SVGIcon className={className}>
    <path d="M7 10v12" />
    <path d="M18 10V4a2 2 0 0 0-2-2H8.5a2 2 0 0 0-1.8.9L3 10v10h12.5a2.5 2.5 0 0 0 2.5-2.5V10Z" />
  </SVGIcon>
);

export const ThumbsDownIcon: React.FC<{ className?: string }> = ({ className }) => (
  <SVGIcon className={className}>
    <path d="M7 14V2" />
    <path d="M18 14v6a2 2 0 0 1-2 2H8.5a2 2 0 0 1-1.8-.9L3 14V4h12.5a2.5 2.5 0 0 1 2.5 2.5V14Z" />
  </SVGIcon>
);

export const BrainCircuitIcon: React.FC<{ className?: string }> = ({ className }) => (
  <SVGIcon className={className}>
    <path d="M12 2a4.5 4.5 0 0 0-4.5 4.5v.5a4.5 4.5 0 0 0-4.5 4.5v2a4.5 4.5 0 0 0 4.5 4.5h.5a4.5 4.5 0 0 0 4.5 4.5h4a4.5 4.5 0 0 0 4.5-4.5v-.5a4.5 4.5 0 0 0 4.5-4.5v-2a4.5 4.5 0 0 0-4.5-4.5h-.5A4.5 4.5 0 0 0 12 2Z" />
    <path d="M12 7v10" />
    <path d="M16.5 9.5h-9" />
    <path d="M16.5 14.5h-9" />
    <path d="M9 12v.01" />
    <path d="M15 12v.01" />
    <path d="M7.5 9.5v5" />
    <path d="M16.5 9.5v5" />
  </SVGIcon>
);

export const ArrowLeftCircleIcon: React.FC<{ className?: string }> = ({ className }) => (
    <SVGIcon className={className}>
        <circle cx="12" cy="12" r="10"></circle>
        <polyline points="12 8 8 12 12 16"></polyline>
        <line x1="16" y1="12" x2="8" y2="12"></line>
    </SVGIcon>
);

export const ArrowRightCircleIcon: React.FC<{ className?: string }> = ({ className }) => (
    <SVGIcon className={className}>
        <circle cx="12" cy="12" r="10"></circle>
        <polyline points="12 16 16 12 12 8"></polyline>
        <line x1="8" y1="12" x2="16" y2="12"></line>
    </SVGIcon>
);

export const EyeOffIcon: React.FC<{ className?: string }> = ({ className }) => (
    <SVGIcon className={className}>
        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07l-2.6-2.6" />
        <line x1="1" y1="1" x2="23" y2="23" />
    </SVGIcon>
);

export const ScratchIcon: React.FC<{ className?: string }> = ({ className }) => (
  <SVGIcon className={className}>
     <path d="M2.5 10.5 8 5l4 8L17.5 4.5l4 9" />
  </SVGIcon>
);

export const LockIcon: React.FC<{ className?: string }> = ({ className }) => (
    <SVGIcon className={className}>
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </SVGIcon>
  );
  
export const TargetIcon: React.FC<{ className?: string }> = ({ className }) => (
    <SVGIcon className={className}>
        <circle cx="12" cy="12" r="10" />
        <circle cx="12" cy="12" r="6" />
        <circle cx="12" cy="12" r="2" />
    </SVGIcon>
);

export const MousePointerClickIcon: React.FC<{ className?: string }> = ({ className }) => (
    <SVGIcon className={className}>
        <path d="M9 9l5 12 1.8-5.2L21 14l-4.2-7.2L11.6 5z" />
        <path d="M13.5 13.5L9 9" />
        <path d="M22 2l-4.5 4.5" />
    </SVGIcon>
);

export const BonnetIcon: React.FC<{ className?: string }> = ({ className }) => (
    <SVGIcon className={className} strokeWidth="1.5">
        <path d="M20 15v-3c0-.83-.67-1.5-1.5-1.5H5.5C4.67 10.5 4 11.17 4 12v3"/>
        <path d="M4 15h16"/>
        <path d="m4 11-2-5h20l-2 5"/>
    </SVGIcon>
);

export const DoorIcon: React.FC<{ className?: string }> = ({ className }) => (
    <SVGIcon className={className} strokeWidth="1.5">
        <path d="M19 19V5a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v14"/>
        <path d="M14 12h1"/>
    </SVGIcon>
);

export const RoofIcon: React.FC<{ className?: string }> = ({ className }) => (
    <SVGIcon className={className} strokeWidth="1.5">
        <path d="M2 15h20"/>
        <path d="M4 15l-2-6h20l-2 6"/>
    </SVGIcon>
);

export const BootIcon: React.FC<{ className?: string }> = ({ className }) => (
    <SVGIcon className={className} strokeWidth="1.5">
        <path d="M20 12v3c0 .83-.67 1.5-1.5-1.5H5.5c-.83 0-1.5-.67-1.5-1.5v-3"/>
        <path d="m4 12 2-7h12l2 7"/>
        <path d="M4 12h16"/>
    </SVGIcon>
);

export const GuardIcon: React.FC<{ className?: string }> = ({ className }) => (
    <SVGIcon className={className} strokeWidth="1.5">
        <path d="M4 12v3.8c0 1.2 1 2.2 2.2 2.2h.6"/>
        <path d="M18 18h-1.8c-1.2 0-2.2-1-2.2-2.2V12"/>
        <path d="M4 12h14"/>
        <path d="M18 12l-2-7H8l-2 7"/>
    </SVGIcon>
);

export const BumperIcon: React.FC<{ className?: string }> = ({ className }) => (
    <SVGIcon className={className} strokeWidth="1.5">
        <path d="M4 16h16"/>
        <path d="M2 12h20"/>
        <path d="M5 12l-1.8-6.2a1 1 0 0 1 .9-1.3l14 4a1 1 0 0 1 .5 1.5L19 12"/>
    </SVGIcon>
);

export const CantRailIcon: React.FC<{ className?: string }> = ({ className }) => (
    <SVGIcon className={className} strokeWidth="1.5">
        <path d="M22 10h-2.1c-.6 0-1.2.3-1.5.8L16 15H8l-2.4-4.2c-.3-.5-.9-.8-1.5-.8H2"/>
        <path d="m5 10-2-5h18l-2 5"/>
    </SVGIcon>
);

// New icons for the professional dashboard
export const DashboardIcon: React.FC<{ className?: string }> = ({ className }) => (
    <SVGIcon className={className}>
        <rect x="3" y="3" width="7" height="9" />
        <rect x="14" y="3" width="7" height="5" />
        <rect x="3" y="16" width="7" height="5" />
        <rect x="14" y="12" width="7" height="9" />
    </SVGIcon>
);

export const CustomersIcon: React.FC<{ className?: string }> = ({ className }) => (
    <SVGIcon className={className}>
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </SVGIcon>
);

export const WorkOrdersIcon: React.FC<{ className?: string }> = ({ className }) => (
    <SVGIcon className={className}>
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="12" y1="18" x2="12" y2="12" />
        <line x1="9" y1="15" x2="15" y2="15" />
    </SVGIcon>
);

export const WorkflowIcon: React.FC<{ className?: string }> = ({ className }) => (
    <SVGIcon className={className}>
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </SVGIcon>
);

export const BookingIcon: React.FC<{ className?: string }> = ({ className }) => (
    <SVGIcon className={className}>
        <path d="M8 2v4" />
        <path d="M16 2v4" />
        <rect x="3" y="4" width="18" height="18" rx="2" />
        <path d="M3 10h18" />
        <path d="M8 14h.01" />
        <path d="M12 14h.01" />
        <path d="M16 14h.01" />
        <path d="M8 18h.01" />
        <path d="M12 18h.01" />
        <path d="M16 18h.01" />
    </SVGIcon>
);

export const ReportsIcon: React.FC<{ className?: string }> = ({ className }) => (
    <SVGIcon className={className}>
        <path d="M3 3v18h18" />
        <path d="M18 17V9" />
        <path d="M13 17V5" />
        <path d="M8 17v-3" />
    </SVGIcon>
);

export const PlusIcon: React.FC<{ className?: string }> = ({ className }) => (
    <SVGIcon className={className}>
        <line x1="12" y1="5" x2="12" y2="19"></line>
        <line x1="5" y1="12" x2="19" y2="12"></line>
    </SVGIcon>
);

export const ChevronLeftIcon: React.FC<{ className?: string }> = ({ className }) => (
    <SVGIcon className={className}>
        <polyline points="15 18 9 12 15 6"></polyline>
    </SVGIcon>
);

export const ChevronRightIcon: React.FC<{ className?: string }> = ({ className }) => (
    <SVGIcon className={className}>
        <polyline points="9 18 15 12 9 6"></polyline>
    </SVGIcon>
);

export const TrendingUpIcon: React.FC<{ className?: string }> = ({ className }) => (
    <SVGIcon className={className}>
        <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline>
        <polyline points="17 6 23 6 23 12"></polyline>
    </SVGIcon>
);

export const MoreVerticalIcon: React.FC<{ className?: string }> = ({ className }) => (
    <SVGIcon className={className}>
        <circle cx="12" cy="12" r="1"></circle>
        <circle cx="12" cy="5" r="1"></circle>
        <circle cx="12" cy="19" r="1"></circle>
    </SVGIcon>
);

export const ArchiveBoxIcon: React.FC<{ className?: string }> = ({ className }) => (
    <SVGIcon className={className}>
        <rect x="2" y="5" width="20" height="14" rx="2" />
        <path d="M2 10h20" />
        <path d="M10 14h4" />
    </SVGIcon>
);

export const XCircleIcon: React.FC<{ className?: string }> = ({ className }) => (
    <SVGIcon className={className}>
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="15" y1="9" x2="9" y2="15"></line>
        <line x1="9" y1="9" x2="15" y2="15"></line>
    </SVGIcon>
);

export const PencilIcon: React.FC<{ className?: string }> = ({ className }) => (
    <SVGIcon className={className}>
        <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
    </SVGIcon>
);

export const Trash2Icon: React.FC<{ className?: string }> = ({ className }) => (
    <SVGIcon className={className}>
        <polyline points="3 6 5 6 21 6"></polyline>
        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
        <line x1="10" y1="11" x2="10" y2="17"></line>
        <line x1="14" y1="11" x2="14" y2="17"></line>
    </SVGIcon>
);

export const ClockIcon: React.FC<{ className?: string }> = ({ className }) => (
    <SVGIcon className={className}>
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
    </SVGIcon>
);

export const WrenchIcon: React.FC<{ className?: string }> = ({ className }) => (
    <SVGIcon className={className}>
        <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
    </SVGIcon>
);

export const BellIcon: React.FC<{ className?: string }> = ({ className }) => (
    <SVGIcon className={className}>
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </SVGIcon>
);

export const ImageIcon: React.FC<{ className?: string }> = ({ className }) => (
    <SVGIcon className={className}>
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
        <circle cx="8.5" cy="8.5" r="1.5" />
        <polyline points="21 15 16 10 5 21" />
    </SVGIcon>
);

export const HelpCircleIcon: React.FC<{ className?: string }> = ({ className }) => (
    <SVGIcon className={className}>
        <circle cx="12" cy="12" r="10" />
        <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
    </SVGIcon>
);

export const BookOpenIcon: React.FC<{ className?: string }> = ({ className }) => (
    <SVGIcon className={className}>
        <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
        <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
    </SVGIcon>
);

export const VinciIcon: React.FC<{ className?: string }> = ({ className }) => (
    <SVGIcon className={className} stroke="currentColor" fill="none" strokeWidth="2">
        <path d="M12 2a10 10 0 0 0-10 10v1.5a2.5 2.5 0 0 0 2.5 2.5h15A2.5 2.5 0 0 0 22 13.5V12a10 10 0 0 0-10-10z" />
        <circle cx="8.5" cy="11.5" r=".5" fill="currentColor"/>
        <circle cx="15.5" cy="11.5" r=".5" fill="currentColor"/>
        <path d="M9 15c.5 1 2 2 3 2s2.5-1 3-2" />
    </SVGIcon>
);

export const TicketIcon: React.FC<{ className?: string }> = ({ className }) => (
    <SVGIcon className={className}>
        <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>
        <path d="M12 2v4"/>
        <path d="M10 4h4"/>
        <path d="M8 12h8"/>
        <path d="M8 16h8"/>
    </SVGIcon>
);

export const PaintBrushIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <SVGIcon {...props}>
    <path d="M18.375 2.625a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4Z" />
    <path d="m15 6.5 3 3" />
    <path d="M6 20a6 6 0 0 1 12 0" />
    <path d="M12 15v3" />
  </SVGIcon>
);

export const SparklesIcon: React.FC<{ className?: string }> = ({ className }) => (
    <SVGIcon className={className}>
        <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" stroke="currentColor" fill="currentColor" strokeWidth="0"/>
    </SVGIcon>
);

export const AiSparklesIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" xmlns="http://www.w3.org/2000/svg">
        {/* Large sparkle */}
        <path d="M12 2L13.5 7.5L19 9L13.5 10.5L12 16L10.5 10.5L5 9L10.5 7.5L12 2Z" />
        {/* Small sparkle top right */}
        <path d="M18 4L18.5 5.5L20 6L18.5 6.5L18 8L17.5 6.5L16 6L17.5 5.5L18 4Z" />
        {/* Medium sparkle bottom right */}
        <path d="M17 14L18 17L21 18L18 19L17 22L16 19L13 18L16 17L17 14Z" />
    </svg>
);

export const DownloadIcon: React.FC<{ className?: string }> = ({ className }) => (
  <SVGIcon className={className}>
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" y1="15" x2="12" y2="3" />
  </SVGIcon>
);

export const CodeIcon: React.FC<{ className?: string }> = ({ className }) => (
  <SVGIcon className={className}>
    <polyline points="16 18 22 12 16 6" />
    <polyline points="8 6 2 12 8 18" />
  </SVGIcon>
);