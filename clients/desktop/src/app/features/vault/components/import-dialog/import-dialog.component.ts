import { Component, EventEmitter, Output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ImportService, ImportResult, ImportFormat } from '../../services/import.service';

@Component({
  selector: 'app-import-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './import-dialog.component.html',
  styleUrls: ['./import-dialog.component.scss']
})
export class ImportDialogComponent {
  @Output() close = new EventEmitter<void>();
  @Output() importComplete = new EventEmitter<ImportResult>();

  formats = signal<ImportFormat[]>([]);
  selectedFormat = signal<string>('generic-csv');
  selectedFile = signal<File | null>(null);
  isImporting = signal(false);
  importResult = signal<ImportResult | null>(null);
  showResult = signal(false);

  constructor(private importService: ImportService) {
    this.formats.set(this.importService.getSupportedFormats());
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] || null;
    this.selectedFile.set(file);
    this.importResult.set(null);
    this.showResult.set(false);
  }

  onFormatChange(event: Event): void {
    const select = event.target as HTMLSelectElement;
    this.selectedFormat.set(select.value);
  }

  async importFile(): Promise<void> {
    const file = this.selectedFile();
    if (!file) {
      return;
    }

    this.isImporting.set(true);
    this.importResult.set(null);
    this.showResult.set(false);

    try {
      const result = await this.importService.importFromFile(file, this.selectedFormat());
      this.importResult.set(result);
      this.showResult.set(true);

      if (result.success) {
        this.importComplete.emit(result);
      }
    } catch (error: any) {
      this.importResult.set({
        success: false,
        imported: 0,
        failed: 0,
        skipped: 0,
        errors: [error.message || 'Unknown error occurred']
      });
      this.showResult.set(true);
    } finally {
      this.isImporting.set(false);
    }
  }

  closeDialog(): void {
    this.close.emit();
  }

  getResultIcon(): string {
    const result = this.importResult();
    if (!result) return '';
    return result.success ? '✅' : '❌';
  }

  getResultClass(): string {
    const result = this.importResult();
    if (!result) return '';
    return result.success ? 'success' : 'error';
  }

  getSelectedFormatDescription(): string {
    const format = this.formats().find(f => f.id === this.selectedFormat());
    return format?.description || '';
  }
}
