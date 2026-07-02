import { Injectable, NotFoundException } from '@nestjs/common';
import { TenantContextService } from '@common/tenancy/tenant-context.service';
import { DepositService } from '@modules/billing/deposit.service';
import { Inspection, InspectionItem, InspectionType } from './inspection.entity';
import { sumDeductions, deductionList } from './inspection-calc';

@Injectable()
export class InspectionsService {
  constructor(
    private readonly tenant: TenantContextService,
    private readonly deposits: DepositService,
  ) {}

  ping(): string {
    return 'Inspections module ready';
  }

  create(input: { unitId: string; leaseId?: string; type: InspectionType }): Promise<Inspection> {
    const repo = this.tenant.getRepository(Inspection);
    return repo.save(
      repo.create({
        vendorId: this.tenant.vendorId ?? undefined,
        unitId: input.unitId,
        leaseId: input.leaseId,
        type: input.type,
        status: 'draft',
        checklist: [],
      }),
    );
  }

  async recordItems(id: string, items: InspectionItem[]): Promise<Inspection> {
    const repo = this.tenant.getRepository(Inspection);
    const insp = await repo.findOne({ where: { id } });
    if (!insp) throw new NotFoundException('Inspection not found');
    insp.checklist = items;
    insp.status = 'completed';
    insp.conductedOn = new Date().toISOString().slice(0, 10);
    return repo.save(insp);
  }

  async signOff(id: string): Promise<Inspection> {
    const repo = this.tenant.getRepository(Inspection);
    const insp = await repo.findOne({ where: { id } });
    if (!insp) throw new NotFoundException('Inspection not found');
    insp.tenantSignoff = true;
    insp.status = 'signed_off';
    return repo.save(insp);
  }

  get(id: string): Promise<Inspection | null> {
    return this.tenant.getRepository(Inspection).findOne({ where: { id } });
  }

  /**
   * Apply a move-out inspection's damage deductions to the deposit return.
   * Closes the loop: inspection findings -> lawful deposit withholding + refund.
   */
  async applyToDeposit(inspectionId: string, depositId: string) {
    const insp = await this.tenant.getRepository(Inspection).findOne({ where: { id: inspectionId } });
    if (!insp) throw new NotFoundException('Inspection not found');
    const deposit = await this.deposits.returnDeposit(depositId, deductionList(insp.checklist));
    return { deductionsTotal: sumDeductions(insp.checklist), deposit };
  }
}
