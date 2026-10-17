/**
 * The skyline container and its CSS renderer.
 *
 * Two of these cases are regression guards rather than features. The scene
 * wrapper was briefly `aria-hidden` while holding focusable tower buttons,
 * which is the same defect the panel spec found in the Day 7 focus trap:
 * reachable by Tab, invisible to a screen reader. And the ranking must carry
 * the same order as the towers, because it is the only path on a narrow screen.
 */
import { render, screen, within } from '@testing-library/react';
import Skyline from '@/components/gods-eye/skyline';
import type { PortfolioUnit } from '@/components/gods-eye/state';

let seq = 0;
function unit(over: Partial<PortfolioUnit> = {}): PortfolioUnit {
  seq += 1;
  return {
    unitId: `u${seq}`,
    propertyId: 'p1',
    propertyName: 'Alpha Court',
    label: `A${seq}`,
    unitStatus: 'occupied',
    leaseId: null,
    leaseStatus: null,
    leaseEndDate: null,
    tenantId: null,
    rentAmount: 10000,
    outstanding: 0,
    maxDaysOverdue: 0,
    openTickets: 0,
    urgentTickets: 0,
    lastInspectionOn: null,
    state: 'ok',
    severity: 0,
    flags: [],
    arrearsBucket: null,
    occupied: true,
    ...over,
  };
}

function property(id: string, name: string, count: number, owing: number[] = []): PortfolioUnit[] {
  const out: PortfolioUnit[] = [];
  for (let i = 0; i < count; i += 1) {
    const owed = owing[i] ?? 0;
    out.push(
      unit({
        propertyId: id,
        propertyName: name,
        outstanding: owed,
        state: owed > 0 ? 'arrears_61_90' : 'ok',
      }),
    );
  }
  return out;
}

// Interpolating stub, so a key with values can be asserted on.
const t = (key: string, vars?: Record<string, string | number>) =>
  vars ? `${key} ${Object.values(vars).join('/')}` : key;
const money = (n: number) => `R ${n}`;
const num = (n: number) => String(n);

function draw(units: PortfolioUnit[], over: Partial<React.ComponentProps<typeof Skyline>> = {}) {
  const onOpen = jest.fn();
  render(
    <Skyline units={units} onOpen={onOpen} activeId={null} money={money} number={num} t={t} {...over} />,
  );
  return { onOpen };
}

const threeProperties = () => [
  ...property('p1', 'Alpha Court', 4, [0, 0, 0, 0]),
  ...property('p2', 'Bravo Place', 4, [5000, 0, 0, 0]),
  ...property('p3', 'Delta Mews', 4, [900, 0, 0, 0]),
];

describe('the towers', () => {
  it('gives each one an accessible name carrying the numbers the picture encodes', () => {
    draw(threeProperties());
    const tower = screen.getByRole('button', { name: /^Bravo Place, 4 units, 1 in arrears/ });
    expect(tower).toHaveAccessibleName('Bravo Place, 4 units, 1 in arrears, R 5000 outstanding');
  });

  it('is reachable by a screen reader, not hidden behind an aria-hidden ancestor', () => {
    // The guard: `getByRole` ignores anything inside an aria-hidden subtree,
    // so this case fails outright if the scene wrapper hides its own buttons.
    draw(threeProperties());
    expect(screen.getByRole('button', { name: /Alpha Court, 4 units/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Delta Mews, 4 units/ })).toBeInTheDocument();
  });

  it('opens the property it stands for', () => {
    const { onOpen } = draw(threeProperties());
    screen.getByRole('button', { name: /Delta Mews, 4 units/ }).click();
    expect(onOpen).toHaveBeenCalledWith('p3');
  });

  it('draws one window per unit', () => {
    draw(property('p1', 'Alpha Court', 7, [100, 0, 0, 0, 0, 0, 0]));
    const tower = screen.getByRole('button', { name: /^Alpha Court, 7 units/ });
    // The facade is the grid span; its children are the windows, one per unit.
    const facade = tower.querySelector('span.grid');
    expect(facade).not.toBeNull();
    expect(facade?.children).toHaveLength(7);
  });
});

describe('the ranking', () => {
  it('carries the same order as the towers — worst first', () => {
    draw(threeProperties());
    const names = screen
      .getAllByRole('button')
      .map((b) => b.textContent || '')
      .filter((text) => text.includes('godsEye.unitsInProperty'));
    expect(names[0]).toContain('Bravo Place');
    expect(names[1]).toContain('Delta Mews');
    expect(names[2]).toContain('Alpha Court');
  });

  it('marks the property that is currently open', () => {
    draw(threeProperties(), { activeId: 'p3' });
    const current = screen.getAllByRole('button').filter((b) => b.getAttribute('aria-current') === 'true');
    expect(current).toHaveLength(1);
    expect(current[0].textContent).toContain('Delta Mews');
  });

  it('shows an em dash rather than a zero for a property that owes nothing', () => {
    draw(property('p1', 'Alpha Court', 3));
    const row = screen.getAllByRole('button').find((b) => b.textContent?.includes('Alpha Court'));
    expect(row?.textContent).toContain('—');
    expect(row?.textContent).not.toContain('R 0');
  });
});

describe('the narrow-screen and screen-reader paths', () => {
  it('states the scene in words as well as pixels', () => {
    draw(threeProperties());
    expect(
      screen.getByText(/3 properties, 12 units\. most at risk: Bravo Place, 1 of 4 units in arrears\./),
    ).toBeInTheDocument();
  });

  it('points a narrow screen at the ranking instead of a squeezed scene', () => {
    draw(threeProperties());
    expect(screen.getByText('godsEye.skylineNarrow')).toBeInTheDocument();
  });
});

describe('a portfolio bigger than the scene', () => {
  it('says how much it is not drawing', () => {
    const units: PortfolioUnit[] = [];
    for (let i = 0; i < 20; i += 1) {
      units.push(...property(`p${i}`, `P${i}`, 3, [1000 - i * 10, 0, 0]));
    }
    draw(units);
    expect(screen.getByText(/godsEye\.skylineNotDrawn 4\/12/)).toBeInTheDocument();
  });

  it('stays quiet when everything fits', () => {
    draw(threeProperties());
    expect(screen.queryByText(/godsEye\.skylineNotDrawn/)).toBeNull();
  });
});

describe('an empty portfolio', () => {
  it('says so rather than drawing an empty ground plane', () => {
    draw([]);
    expect(screen.getByText('No properties to show.')).toBeInTheDocument();
    expect(screen.queryByRole('button')).toBeNull();
  });
});
