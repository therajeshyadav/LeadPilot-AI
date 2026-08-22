import type { CreateLeadInput, LeadStatus, UpdateLeadDiscoveryInput } from "@leadpilot/shared";

import type { LeadRepository } from "../repositories/contracts.js";
import type { LeadRecord, PaginatedResult } from "../types/domain.js";
import { ConflictError, NotFoundError } from "../utils/errors.js";

export class LeadService {
  constructor(private readonly leads: LeadRepository) {}

  async create(input: CreateLeadInput): Promise<LeadRecord> {
    const existing = await this.leads.findByPhone(input.phone);
    if (existing) throw new ConflictError("A lead with this phone number already exists.");
    return this.leads.create(input);
  }

  async get(id: string): Promise<LeadRecord> {
    const lead = await this.leads.findById(id);
    if (!lead) throw new NotFoundError("Lead");
    return lead;
  }

  async list(input: { limit: number; offset: number; status?: LeadStatus }): Promise<PaginatedResult<LeadRecord>> {
    return this.leads.list(input);
  }

  async updateDiscovery(id: string, input: UpdateLeadDiscoveryInput): Promise<LeadRecord> {
    await this.get(id);
    return this.leads.updateDiscovery(id, input);
  }
}
