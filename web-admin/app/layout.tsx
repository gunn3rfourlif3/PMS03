import './globals.css';
import Nav from '@/components/nav';
import Footer from '@/components/footer';
import BrandProvider from '@/components/brand-provider';

export const metadata = { title: 'Back-office' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <BrandProvider>
          <Nav />
          <main className="app-main">{children}</main>
          <Footer />
        </BrandProvider>
      </body>
    </html>
  );
}
