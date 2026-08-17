import { renderEmail } from '../src/common/email/email';
import { mailSafeLogo } from '../src/common/email/email-brand';
import { emailMarkPng } from '../src/common/email/email-mark';

const API = 'https://api.locare.co.za/api';

describe('mailSafeLogo', () => {
  it('accepts https raster images', () => {
    expect(mailSafeLogo('https://x.co.za/logo.png')).toBe('https://x.co.za/logo.png');
    expect(mailSafeLogo('https://x.co.za/logo.JPG?v=2')).toBe('https://x.co.za/logo.JPG?v=2');
  });

  // Each of these renders as a broken-image icon in Gmail or Outlook, which
  // looks worse than the wordmark it falls back to.
  it.each([
    ['svg', 'https://x.co.za/logo.svg'],
    ['plain http', 'http://x.co.za/logo.png'],
    ['relative', '/brand/logo.png'],
    ['empty', ''],
    ['undefined', undefined],
  ])('rejects %s', (_label, url) => {
    expect(mailSafeLogo(url as string)).toBeUndefined();
  });
});

describe('email header', () => {
  it('puts the fallback mark next to the name when there is no logo', () => {
    const html = renderEmail({ agencyName: 'Dantalan', markUrl: API, heading: 'Hi' });
    expect(html).toContain('/brand/email-mark-white.png'); // white: the bar is ink
    expect(html).toContain('Dantalan</td>'); // name stays live text
  });

  it('uses a real logo alone, on a light bar', () => {
    const html = renderEmail({
      agencyName: 'Dantalan', markUrl: API, logoUrl: 'https://x.co.za/logo.png', heading: 'Hi',
    });
    expect(html).not.toContain('email-mark');
    // An agency's stored logo is drawn on a white header in their apps, so it is
    // almost certainly dark — an ink bar would swallow it.
    expect(html).toContain('background:#ffffff;padding:20px 32px');
  });

  it('honours an explicit ink header for a light logo variant', () => {
    const html = renderEmail({
      logoUrl: 'https://locare.co.za/brand/locare-logo-email-white.png',
      headerStyle: 'ink', heading: 'Hi',
    });
    expect(html).toContain('background:#14161B;padding:20px 32px');
  });

  it('degrades to the wordmark when no mark URL is configured', () => {
    const html = renderEmail({ agencyName: 'Dantalan', heading: 'Hi' });
    expect(html).not.toContain('<img');
    expect(html).toContain('Dantalan</td>');
  });

  it('re-tints the whole template from brandColor', () => {
    const html = renderEmail({
      agencyName: 'Dantalan', brandColor: '#6B3FA0', heading: 'Hi',
      buttons: [{ label: 'Go', url: 'https://x' }],
    });
    expect(html).toContain('background:#6B3FA0;border-radius:10px'); // button
    expect(html).toContain('height:3px;background:#6B3FA0'); // brand rule
    expect(html.toLowerCase()).not.toContain('#0f6e56'); // no Locare green left
  });
});

describe('emailMarkPng', () => {
  it.each(['white', 'ink'] as const)('%s is a real PNG', (variant) => {
    const png = emailMarkPng(variant);
    expect(png.subarray(0, 8)).toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    expect(png.length).toBeGreaterThan(500);
  });

  it('the two variants differ', () => {
    expect(emailMarkPng('white').equals(emailMarkPng('ink'))).toBe(false);
  });
});
