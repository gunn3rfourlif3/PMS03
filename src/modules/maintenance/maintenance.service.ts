import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { TenantContextService } from '@common/tenancy/tenant-context.service';
import { ExpensesService } from '@modules/expenses/expenses.service';
import { Ticket, TicketPriority } from './ticket.entity';
import { WorkOrder } from './work-order.entity';
import { canTransitionWorkOrder } from './work-order-transitions';

export interface CreateTicketInput {
  unitId: string;
  category: string;
  description: string;
  priority?: TicketPriority;
  media?: string[];
}

/**
 * Maintenance / ticketing. Lifecycle:
 *   ticket open -> (manager assigns) work order -> in_progress -> completed
 *   (cost posts to the ledger as a property expense) -> tenant approves -> closed.
 */
@Injectable()
export class MaintenanceService {
  private readonly logger = new Logger(MaintenanceService.name);

  constructor(
    private readonly tenant: TenantContextService,
    private readonly expenses: ExpensesService,
  ) {}

  ping(): string {
    return 'Maintenance module ready';
  }

  // ---- Tenant ----
  createTicket(input: CreateTicketInput, reporterId?: string): Promise<Ticket> {
    const repo = this.tenant.getRepository(Ticket);
    return repo.save(
      repo.create({
        vendorId: this.tenant.vendorId ?? undefined,
        unitId: input.unitId,
        reporterId,
        category: input.category,
        description: input.description,
        priority: input.priority ?? 'medium',
        media: input.media ?? [],
        status: 'open',
      }),
    );
  }

  myTickets(reporterId: string): Promise<Ticket[]> {
    return this.tenant.getRepository(Ticket).find({
      where: { reporterId },
      order: { createdAt: 'DESC' },
    });
  }

  async approveTicket(ticketId: string): Promise<Ticket> {
    const repo = this.tenant.getRepository(Ticket);
    const ticket = await repo.findOne({ where: { id: ticketId } });
    if (!ticket) throw new NotFoundException('Ticket not found');
    if (ticket.status !== 'resolved') {
      throw new BadRequestException('Only a resolved ticket can be approved');
    }
    ticket.status = 'closed';
    return repo.save(ticket);
  }

  // ---- Manager ----
  listTickets(): Promise<Ticket[]> {
    return this.tenant.getRepository(Ticket).find({ order: { createdAt: 'DESC' } });
  }

  /** All work orders for the vendor, enriched with the assigned provider's name. */
  listWorkOrders(): Promise<unknown[]> {
    return this.tenant.getManager().query(`
      SELECT w.id, w.ticket_id AS "ticketId", w.contractor_id AS "contractorId",
             w.status, w.scheduled_for AS "scheduledFor", w.cost, w.notes,
             w.expense_id AS "expenseId", w.created_at AS "createdAt",
             sp.name AS "contractorName", sp.category AS "contractorCategory"
      FROM work_orders w
      LEFT JOIN service_providers sp ON sp.id = w.contractor_id
      ORDER BY w.created_at DESC;
    `);
  }

  async assign(ticketId: string, contractorId?: string, scheduledFor?: string): Promise<WorkOrder> {
    const tickets = this.tenant.getRepository(Ticket);
    const ticket = await tickets.findOne({ where: { id: ticketId } });
    if (!ticket) throw new NotFoundException('Ticket not found');

    const wos = this.tenant.getRepository(WorkOrder);
    const wo = await wos.save(
      wos.create({
        vendorId: this.tenant.vendorId ?? undefined,
        ticketId,
        contractorId,
        status: 'assigned',
        scheduledFor: scheduledFor ? new Date(scheduledFor) : undefined,
      }),
    );
    ticket.status = 'assigned';
    await tickets.save(ticket);
    return wo;
  }

  async progressWorkOrder(workOrderId: string): Promise<WorkOrder> {
    return this.transition(workOrderId, 'in_progress');
  }

  /** Complete a work order; a cost posts a property expense to the ledger. */
  async completeWorkOrder(workOrderId: string, cost?: number, ownerBillable = false): Promise<WorkOrder> {
    const wos = this.tenant.getRepository(WorkOrder);
    const wo = await wos.findOne({ where: { id: workOrderId } });
    if (!wo) throw new NotFoundException('Work order not found');
    if (!canTransitionWorkOrder(wo.status, 'completed')) {
      throw new BadRequestException(`Cannot complete a ${wo.status} work order`);
    }

    if (cost && cost > 0) {
      const ticket = await this.tenant.getRepository(Ticket).findOne({ where: { id: wo.ticketId } });
      const expense = await this.expenses.record({
        category: 'maintenance',
        amount: cost,
        incurredOn: new Date().toISOString().slice(0, 10),
        unitId: ticket?.unitId,
        ownerBillable,
      });
      wo.cost = cost;
      wo.expenseId = expense.id;
    }
    wo.status = 'completed';
    await wos.save(wo);

    // Reflect on the parent ticket.
    const tickets = this.tenant.getRepository(Ticket);
    const ticket = await tickets.findOne({ where: { id: wo.ticketId } });
    if (ticket) { ticket.status = 'resolved'; await tickets.save(ticket); }

    this.logger.debug(`Work order ${wo.id} completed (cost ${cost ?? 0})`);
    return wo;
  }

  private async transition(workOrderId: string, to: WorkOrder['status']): Promise<WorkOrder> {
    const wos = this.tenant.getRepository(WorkOrder);
    const wo = await wos.findOne({ where: { id: workOrderId } });
    if (!wo) throw new NotFoundException('Work order not found');
    if (!canTransitionWorkOrder(wo.status, to)) {
      throw new BadRequestException(`Cannot move work order from ${wo.status} to ${to}`);
    }
    wo.status = to;
    return wos.save(wo);
  }
}
