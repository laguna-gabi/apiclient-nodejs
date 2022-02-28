import { HealthPersona } from '.';

export class PersonasOptions {
  private options: Map<HealthPersona, { q1: string[]; q2: string[] }> = new Map();

  constructor() {
    this.options.set(HealthPersona.active, { q1: ['4'], q2: ['3', '4'] });
    this.options.set(HealthPersona.passive, { q1: ['1', '2', '3'], q2: ['1', '2'] });
    this.options.set(HealthPersona.highEffort, { q1: ['1', '2', '3'], q2: ['3', '4'] });
    this.options.set(HealthPersona.complacent, { q1: ['4'], q2: ['1', '2'] });
  }

  get() {
    return this.options;
  }
}
