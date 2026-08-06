import './globals.css';
import { headers } from 'next/headers';
import BrandProvider from '@/components/brand-provider';
import Shell from '@/components/shell';
import { brandForHost } from '@/lib/brand-shared';

export const metadata = { title: 'Back-office' };

// The brand depends on the request's Host header, so this layout can't be
// statically prerendered — otherwise Next bakes one host's brand ("Property
// Manager") into the HTML served to every host, including Locare.
export const dynamic = 'force-dynamic';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const host = headers().get('host') ?? '';
  const brand = brandForHost(host);

  return (
    <html lang="en">
      <body>
        <BrandProvider initial={brand}>
          <Shell>{children}</Shell>
        </BrandProvider>
      </body>
    </html>
  );
}
