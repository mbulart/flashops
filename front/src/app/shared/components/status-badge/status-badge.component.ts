import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-status-badge',
  standalone: true,
  imports: [CommonModule],
  template: `
    <span class="badge status-badge" [ngClass]="badgeClass">{{ label }}</span>
  `,
})
export class StatusBadgeComponent {
  @Input({ required: true }) label!: string;
  @Input() success = false;

  get badgeClass(): string {
    if (this.success) return 'text-bg-success-subtle';
    const lower = this.label
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
    if (
      lower.includes('succes') ||
      lower.includes('success') ||
      lower.includes('ok') ||
      lower.includes('paye')
    ) {
      return 'text-bg-success-subtle';
    }
    if (
      lower.includes('echou') ||
      lower.includes('fail') ||
      lower.includes('error') ||
      lower.includes('reject') ||
      lower.includes('annul') ||
      lower.includes('refus')
    ) {
      return 'text-bg-danger-subtle';
    }
    if (
      lower.includes('attente') ||
      lower.includes('pending') ||
      lower.includes('wait') ||
      lower.includes('cours')
    ) {
      return 'text-bg-warning-subtle';
    }
    return 'text-bg-secondary-subtle';
  }
}
