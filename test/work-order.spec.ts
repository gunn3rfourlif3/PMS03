import { canTransitionWorkOrder } from '../src/modules/maintenance/work-order-transitions';

describe('work order transitions', () => {
  it('allows the happy path', () => {
    expect(canTransitionWorkOrder('assigned', 'in_progress')).toBe(true);
    expect(canTransitionWorkOrder('in_progress', 'completed')).toBe(true);
    expect(canTransitionWorkOrder('completed', 'invoiced')).toBe(true);
  });
  it('allows assigned -> completed (quick jobs)', () => {
    expect(canTransitionWorkOrder('assigned', 'completed')).toBe(true);
  });
  it('blocks illegal and terminal transitions', () => {
    expect(canTransitionWorkOrder('completed', 'in_progress')).toBe(false);
    expect(canTransitionWorkOrder('invoiced', 'completed')).toBe(false);
    expect(canTransitionWorkOrder('assigned', 'invoiced')).toBe(false);
  });
});
