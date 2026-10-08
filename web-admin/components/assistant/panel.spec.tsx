/**
 * Day 7 behaviour, pinned. These cover the keyboard path, the impersonation
 * guard and the signal rules — everything the panel promises that does not
 * need the API, a database or a login. `use-signals` is mocked so no fetch
 * happens here; its own logic is covered by `test/assistant-signals.spec.ts`.
 */
import React from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AssistantPanel, { routeKeyFor } from './panel';
import type { Signal } from './signals';

let pathname = '/partner';
let actor: { id: string } | null = null;
let signals: Signal[] = [];

jest.mock('next/navigation', () => ({ usePathname: () => pathname }));
jest.mock('@/lib/api', () => ({
  actorFromToken: () => actor,
  api: jest.fn(),
}));
jest.mock('./use-signals', () => ({
  useAssistantSignals: () => signals,
}));

beforeEach(() => {
  pathname = '/partner';
  actor = null;
  signals = [];
});

/** The desktop header trigger; the mobile pill is the second one. */
const triggers = () => screen.getAllByRole('button', { name: 'Open help' });
const sheet = () => screen.queryByRole('dialog', { name: 'Help' });

describe('routeKeyFor', () => {
  it('keys a section route on its section', () => {
    expect(routeKeyFor('/partner/pipeline')).toBe('/partner/pipeline');
  });

  it('trims a trailing segment or slash', () => {
    expect(routeKeyFor('/partner/pipeline/123')).toBe('/partner/pipeline');
    expect(routeKeyFor('/partner/pipeline/')).toBe('/partner/pipeline');
  });

  it('falls back to the overview outside /partner', () => {
    expect(routeKeyFor('/admin/changelog')).toBe('/partner');
  });
});

describe('impersonation guard', () => {
  it('renders nothing at all when an actor is viewing', () => {
    actor = { id: 'support-1' };
    const { container } = render(<AssistantPanel />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe('open and close', () => {
  it('is closed by default and offers a trigger', () => {
    render(<AssistantPanel />);
    expect(sheet()).not.toBeInTheDocument();
    expect(triggers().length).toBeGreaterThan(0);
  });

  it('moves focus to the close button on open', async () => {
    const user = userEvent.setup();
    render(<AssistantPanel />);
    await user.click(triggers()[0]);
    expect(sheet()).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Close help' })).toHaveFocus();
  });

  it('closes on Escape and returns focus to the trigger that opened it', async () => {
    const user = userEvent.setup();
    render(<AssistantPanel />);
    const opener = triggers()[0];
    await user.click(opener);
    await user.keyboard('{Escape}');
    expect(sheet()).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
  });

  it('returns focus to the mobile trigger when that is the one used', async () => {
    const user = userEvent.setup();
    render(<AssistantPanel />);
    const mobile = triggers()[1];
    await user.click(mobile);
    await user.click(screen.getByRole('button', { name: 'Close help' }));
    expect(sheet()).not.toBeInTheDocument();
    expect(mobile).toHaveFocus();
  });

  it('closes on a backdrop click', async () => {
    const user = userEvent.setup();
    const { container } = render(<AssistantPanel />);
    await user.click(triggers()[0]);
    const backdrop = container.querySelector('[role="presentation"] > div');
    await user.click(backdrop as Element);
    expect(sheet()).not.toBeInTheDocument();
  });
});

describe('focus trap', () => {
  const stops = () =>
    Array.from(
      (sheet() as HTMLElement).querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ),
    );

  it('wraps forward from the last stop to the first', async () => {
    const user = userEvent.setup();
    signals = [{ id: 'stale-deal', text: 'A deal has not moved', href: '/partner/pipeline' }];
    render(<AssistantPanel />);
    await user.click(triggers()[0]);
    const inside = stops();
    inside[inside.length - 1].focus();
    await user.tab();
    expect(inside[0]).toHaveFocus();
  });

  it('wraps backward from the first stop to the last', async () => {
    const user = userEvent.setup();
    signals = [{ id: 'stale-deal', text: 'A deal has not moved', href: '/partner/pipeline' }];
    render(<AssistantPanel />);
    await user.click(triggers()[0]);
    const inside = stops();
    inside[0].focus();
    await user.tab({ shift: true });
    expect(inside[inside.length - 1]).toHaveFocus();
  });

  it('never lands on the page behind the sheet', async () => {
    const user = userEvent.setup();
    render(<AssistantPanel />);
    await user.click(triggers()[0]);
    for (let i = 0; i < 6; i += 1) {
      await user.tab();
      expect(sheet()).toContainElement(document.activeElement as HTMLElement);
    }
  });
});

describe('signals', () => {
  it('renders nothing rather than an empty state when there are none', async () => {
    const user = userEvent.setup();
    render(<AssistantPanel />);
    await user.click(triggers()[0]);
    expect(within(sheet() as HTMLElement).queryByRole('list')).not.toBeInTheDocument();
    expect(screen.queryByText(/no issues/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('renders each signal as a link above the questions', async () => {
    const user = userEvent.setup();
    signals = [
      { id: 'stale-deal', text: 'A deal has not moved', href: '/partner/pipeline' },
      { id: 'banking-missing', text: 'Banking details are incomplete', href: '/partner/banking' },
    ];
    render(<AssistantPanel />);
    await user.click(triggers()[0]);
    // Scoped to the signal list: since Day 8 the manual pointer is a link too.
    const list = within(sheet() as HTMLElement).getByRole('list');
    const links = within(list).getAllByRole('link');
    expect(links).toHaveLength(2);
    expect(links[0]).toHaveAttribute('href', '/partner/pipeline');
    expect(links[1]).toHaveTextContent('Banking details are incomplete');
    // Above the questions: the first question heading follows the signal list.
    const body = (sheet() as HTMLElement).textContent ?? '';
    expect(body.indexOf('A deal has not moved')).toBeLessThan(body.indexOf('What is pipeline value?'));
  });

  it('closes the panel when a signal is followed', async () => {
    const user = userEvent.setup();
    signals = [{ id: 'banking-missing', text: 'Banking details are incomplete', href: '/partner/banking' }];
    render(<AssistantPanel />);
    await user.click(triggers()[0]);
    const list = within(sheet() as HTMLElement).getByRole('list');
    await user.click(within(list).getByRole('link'));
    expect(sheet()).not.toBeInTheDocument();
  });
});

describe('manual pointer', () => {
  it('links the section to the manual route and closes the panel', async () => {
    const user = userEvent.setup();
    render(<AssistantPanel />);
    await user.click(triggers()[0]);
    const link = within(sheet() as HTMLElement).getByRole('link', { name: 'Overview' });
    expect(link).toHaveAttribute('href', '/partner/manual#overview');
    // The file path stays beside it: the markdown, not the panel, is the source.
    expect(screen.getByText(/Partner-Manual\.md/)).toBeInTheDocument();
    await user.click(link);
    expect(sheet()).not.toBeInTheDocument();
  });
});

describe('curated content', () => {
  it('shows the route’s own questions', async () => {
    const user = userEvent.setup();
    pathname = '/partner/commissions';
    render(<AssistantPanel />);
    await user.click(triggers()[0]);
    expect(within(sheet() as HTMLElement).getByRole('heading', { name: 'Commissions' })).toBeInTheDocument();
    expect(screen.getByText('What is commission calculated on?')).toBeInTheDocument();
  });

  it('is never empty on an unknown route, and names the manual', async () => {
    const user = userEvent.setup();
    pathname = '/partner/something-new';
    render(<AssistantPanel />);
    await user.click(triggers()[0]);
    expect(sheet()).toBeInTheDocument();
    expect(screen.getByText(/Partner-Manual\.md/)).toBeInTheDocument();
  });

  it('states no rate, threshold or rand figure in the commissions copy', async () => {
    const user = userEvent.setup();
    pathname = '/partner/commissions';
    render(<AssistantPanel />);
    await user.click(triggers()[0]);
    const body = (sheet() as HTMLElement).textContent ?? '';
    expect(body).not.toMatch(/R\s?\d/);
    expect(body).not.toMatch(/\d+\s?%/);
    expect(body).not.toMatch(/\b\d+\s?(?:days?|months?)\b/);
  });
});

describe('mobile and reduced motion', () => {
  it('is a full-width sheet below lg and capped only from lg up', async () => {
    const user = userEvent.setup();
    render(<AssistantPanel />);
    await user.click(triggers()[0]);
    const el = sheet() as HTMLElement;
    expect(el).toHaveClass('w-full', 'max-w-none', 'lg:max-w-[420px]');
  });

  it('drops its animation under prefers-reduced-motion', async () => {
    const user = userEvent.setup();
    const { container } = render(<AssistantPanel />);
    await user.click(triggers()[0]);
    expect(sheet()).toHaveClass('motion-reduce:animate-none');
    const backdrop = container.querySelector('[role="presentation"] > div');
    expect(backdrop).toHaveClass('motion-reduce:animate-none');
  });
});
