import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { TenantContextService } from '@common/tenancy/tenant-context.service';
import { Agent, AgentBanking, CommissionType } from './agent.entity';
import { AgentCommission, CommissionStatus, ReferralType } from './agent-commission.entity';

export interface AgentInput {
  name: string;
  email?: string;
  phone?: string;
  company?: string;
  commissionType?: CommissionType;
  commissionValue?: number;
  banking?: AgentBanking;
  notes?: string;
}

export interface RecordCommissionInput {
  agentId: string;
  type: ReferralType;
  sourceLabel: string;
  amount?: number;      // explicit amount (manual). If omitted, computed from the agent's terms.
  baseAmount?: number;  // e.g. monthly rent, for percent-of-first-month.
  note?: string;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

@Injectable()
export class AgentsService {
  constructor(private readonly tenant: TenantContextService) {}

  // ---------- Agents ----------
  listAgents(): Promise<Agent[]> {
    return this.tenant.getRepository(Agent).find({ order: { createdAt: 'DESC' } });
  }

  async getAgent(id: string): Promise<Agent> {
    const a = await this.tenant.getRepository(Agent).findOne({ where: { id } });
    if (!a) throw new NotFoundException('Agent not found');
    return a;
  }

  createAgent(input: AgentInput): Promise<Agent> {
    const repo = this.tenant.getRepository(Agent);
    return repo.save(repo.create({
      vendorId: this.tenant.vendorId ?? undefined,
      name: input.name,
      email: input.email,
      phone: input.phone,
      company: input.company,
      status: 'active',
      commissionType: input.commissionType ?? 'flat',
      commissionValue: input.commissionValue ?? 0,
      banking: input.banking ?? {},
      notes: input.notes,
    }));
  }

  async updateAgent(id: string, input: AgentInput): Promise<Agent> {
    const repo = this.tenant.getRepository(Agent);
    const a = await this.getAgent(id);
    Object.assign(a, {
      name: input.name ?? a.name,
      email: input.email, phone: input.phone, company: input.company,
      commissionType: input.commissionType ?? a.commissionType,
      commissionValue: input.commissionValue ?? a.commissionValue,
      banking: input.banking ?? a.banking,
      notes: input.notes,
    });
    return repo.save(a);
  }

  async setStatus(id: string, status: 'active' | 'inactive'): Promise<Agent> {
    const repo = this.tenant.getRepository(Agent);
    const a = await this.getAgent(id);
    a.status = status;
    return repo.save(a);
  }

  // ---------- Commissions ----------
  private computeAmount(agent: Agent, baseAmount?: number): { basis: CommissionType; amount: number } {
    if (agent.commissionType === 'percent_first_month' && baseAmount) {
      return { basis: 'percent_first_month', amount: round2((Number(agent.commissionValue) / 100) * baseAmount) };
    }
    return { basis: 'flat', amount: round2(Number(agent.commissionValue)) };
  }

  async recordCommission(userId: string | undefined, input: RecordCommissionInput): Promise<AgentCommission> {
    const agent = await this.getAgent(input.agentId);
    let basis: CommissionType;
    let amount: number;
    if (input.amount != null) { basis = 'flat'; amount = round2(Number(input.amount)); }
    else { const c = this.computeAmount(agent, input.baseAmount); basis = c.basis; amount = c.amount; }
    if (!(amount > 0)) throw new BadRequestException('Commission amount must be greater than zero.');

    const repo = this.tenant.getRepository(AgentCommission);
    return repo.save(repo.create({
      vendorId: this.tenant.vendorId ?? undefined,
      agentId: agent.id, type: input.type, sourceLabel: input.sourceLabel,
      basis, amount, status: 'pending', note: input.note, createdBy: userId || undefined,
    }));
  }

  /** Used by the Add-tenant flow when a referring agent is selected. */
  async recordTenantReferral(agentId: string, tenantName: string, rentAmount: number): Promise<void> {
    await this.recordCommission(undefined, { agentId, type: 'tenant', sourceLabel: tenantName || 'Tenant', baseAmount: rentAmount });
  }

  listCommissions(agentId?: string, status?: string): Promise<unknown[]> {
    return this.tenant.getManager().query(
      `SELECT c.id, c.type, c.source_label AS "sourceLabel", c.basis, c.amount, c.status,
              c.approved_at AS "approvedAt", c.paid_at AS "paidAt", c.paid_ref AS "paidRef",
              c.note, c.created_at AS "createdAt", c.agent_id AS "agentId", a.name AS "agentName"
       FROM agent_commissions c JOIN agents a ON a.id = c.agent_id
       WHERE ($1::uuid IS NULL OR c.agent_id = $1) AND ($2::text IS NULL OR c.status = $2)
       ORDER BY (c.status = 'pending') DESC, c.created_at DESC`,
      [agentId ?? null, status ?? null],
    );
  }

  async approve(id: string): Promise<AgentCommission> {
    const c = await this.getCommission(id);
    if (c.status !== 'pending') throw new ConflictException(`Cannot approve a ${c.status} commission.`);
    c.status = 'approved'; c.approvedAt = new Date();
    return this.tenant.getRepository(AgentCommission).save(c);
  }

  async pay(id: string, reference?: string): Promise<AgentCommission> {
    const c = await this.getCommission(id);
    if (c.status === 'paid') throw new ConflictException('Already paid.');
    if (c.status === 'cancelled') throw new ConflictException('Commission is cancelled.');
    c.status = 'paid'; c.paidAt = new Date(); c.paidRef = reference?.trim() || undefined;
    if (!c.approvedAt) c.approvedAt = new Date();
    return this.tenant.getRepository(AgentCommission).save(c);
  }

  async cancel(id: string): Promise<AgentCommission> {
    const c = await this.getCommission(id);
    if (c.status === 'paid') throw new ConflictException('Cannot cancel a paid commission.');
    c.status = 'cancelled';
    return this.tenant.getRepository(AgentCommission).save(c);
  }

  private async getCommission(id: string): Promise<AgentCommission> {
    const c = await this.tenant.getRepository(AgentCommission).findOne({ where: { id } });
    if (!c) throw new NotFoundException('Commission not found');
    return c;
  }

  async statement(agentId: string): Promise<{ agent: Agent; commissions: unknown[]; totals: Record<CommissionStatus, number> }> {
    const agent = await this.getAgent(agentId);
    const commissions = await this.listCommissions(agentId);
    const totals: Record<CommissionStatus, number> = { pending: 0, approved: 0, paid: 0, cancelled: 0 };
    for (const c of commissions as any[]) totals[c.status as CommissionStatus] = round2((totals[c.status as CommissionStatus] ?? 0) + Number(c.amount));
    return { agent, commissions, totals };
  }
}
