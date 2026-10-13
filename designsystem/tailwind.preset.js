/**
 * UngEkonom – Tailwind-preset (v0.1, utkast)
 *
 * Återskapar de egna klassnamn som finns i stitch-assets/tailwind.css så att
 * nya sidor kan byggas med samma klasser (bg-primary-container, text-text-secondary,
 * font-headline-1, gap-space-lg osv.). Lägger också till standardiserade namn
 * för färger som idag skrivs som godtyckliga HEX-värden (t.ex. bg-[#FEF3C7]).
 *
 * Användning:  presets: [require('./designsystem/tailwind.preset.js')]
 */
module.exports = {
  theme: {
    extend: {
      colors: {
        // Varumärke – blått
        'primary-container': '#2563EB',
        'primary-deep': '#1E40AF',
        primary: '#004AC6',
        'primary-tint': '#EFF6FF',
        'primary-fixed-dim': '#B4C5FF',
        'primary-fixed': '#DBE1FF',
        'on-primary': '#FFFFFF',
        // Varumärke – grönt
        'positive-spruce': '#10B981',
        secondary: '#006C4A',
        'positive-wash': '#ECFDF5',
        'secondary-fixed': '#85F8C4',
        // Accent – bärnsten (nya namn, ersätter godtyckliga HEX-klasser)
        'accent-tint': '#FEF3C7',
        'accent-text': '#B45309',
        'accent-strong': '#92400E',
        'accent-icon': '#D97706',
        // Text
        'text-primary': '#0F172A',
        'text-secondary': '#475569',
        'text-tertiary': '#94A3B8',
        'text-muted': '#64748B',
        // Ytor
        'bg-root': '#F9FAFB',
        'surface-card': '#FFFFFF',
        'surface-subdued': '#F3F4F6',
        'border-subtle': '#E2E8F0',
        // Funktion
        'critical-danger': '#DC2626',
        'critical-wash': '#FEE2E2',
        // Arv från Material 3-exporten – fasas ut, använd inte i nytt material
        'surface-container': '#EAEDFF',
        'surface-container-low': '#F2F3FF',
        'surface-dim': '#D2D9F4',
        'surface-tint': '#0053DB',
        'on-surface': '#131B2E',
        'on-surface-variant': '#434655',
      },
      fontFamily: {
        'display-xl': ['Plus Jakarta Sans', 'system-ui', 'sans-serif'],
        'headline-1': ['Plus Jakarta Sans', 'system-ui', 'sans-serif'],
        'headline-2': ['Plus Jakarta Sans', 'system-ui', 'sans-serif'],
        'headline-3': ['Plus Jakarta Sans', 'system-ui', 'sans-serif'],
        'body-regular': ['Plus Jakarta Sans', 'system-ui', 'sans-serif'],
        'body-medium': ['Plus Jakarta Sans', 'system-ui', 'sans-serif'],
        'label-md': ['Plus Jakarta Sans', 'system-ui', 'sans-serif'],
        'caption-micro': ['Plus Jakarta Sans', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        'display-xl': ['36px', { lineHeight: '41px', letterSpacing: '-0.03em', fontWeight: '700' }],
        'headline-1': ['28px', { lineHeight: '34px', letterSpacing: '-0.025em', fontWeight: '600' }],
        'headline-2': ['22px', { lineHeight: '28px', letterSpacing: '-0.02em', fontWeight: '600' }],
        'headline-3': ['18px', { lineHeight: '24px', letterSpacing: '-0.015em', fontWeight: '600' }],
        'body-regular': ['15px', { lineHeight: '23px', fontWeight: '400' }],
        'body-medium': ['15px', { lineHeight: '23px', fontWeight: '500' }],
        'label-md': ['13px', { lineHeight: '18px', letterSpacing: '0.01em', fontWeight: '600' }],
        'caption-micro': ['12px', { lineHeight: '16px', fontWeight: '500' }],
      },
      spacing: {
        'space-xs': '0.25rem',
        'space-sm': '0.5rem',
        'space-md': '0.75rem',
        'space-lg': '1.25rem',
        'space-xl': '2rem',
        margin: '1.5rem',
      },
      maxWidth: {
        container: '1140px',
      },
      boxShadow: {
        header: '0 1px 8px rgba(15,23,42,0.04)',
        button: '0 1px 2px 0 rgba(15,23,42,0.04)',
      },
    },
  },
};
