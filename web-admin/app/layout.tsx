import './globals.css';
import BrandProvider from '@/components/brand-provider';
import Shell from '@/components/shell';

export const metadata = { title: 'Back-office' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <BrandProvider>
          <Shell>{children}</Shell>
        </BrandProvider>
      </body>
    </html>
  );
}
