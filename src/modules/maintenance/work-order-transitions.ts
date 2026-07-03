import { WorkOrderStatus } from './work-order.entity';

/** Allowed work-order status transitions. */
const ALLOWED: Record<WorkOrderStatus, WorkOrderStatus[]> = {
  assigned: ['in_progress', 'completed'],
  in_progress: ['completed'],
  completed: ['invoiced'],
  invoiced: [],
};

export function canTransitionWorkOrder(from: WorkOrderStatus, to: WorkOrderStatus): boolean {
  return ALLOWED[from].includes(to);
}
