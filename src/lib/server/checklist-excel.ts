import ExcelJS from 'exceljs';
import { environments, formatDuration, getChecklist, technologies } from '../checklists.ts';
import type { TechnologyId } from '../checklists.ts';

export async function createChecklistWorkbook(technologyId: TechnologyId) {
  const technology = technologies.find((item) => item.id === technologyId)!;
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'DevOps OXXO';
  workbook.title = `Checklist ${technology.name}`;
  workbook.description = 'Plantilla base. Roles y tiempos estimados sujetos a validacion del equipo.';

  for (const environment of environments) {
    const tasks = getChecklist(technologyId, environment.id);
    const total = tasks.reduce((minutes, task) => minutes + task.minutes, 0);
    const sheet = workbook.addWorksheet(environment.name, {
      views: [{ state: 'frozen', ySplit: 4 }],
      pageSetup: { orientation: 'landscape', paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
    });
    sheet.columns = [{ width: 75 }, { width: 30 }, { width: 52 }, { width: 24 }];
    sheet.mergeCells('A1:D1');
    sheet.getCell('A1').value = `${technology.name} | ${environment.name} - ${environment.label}`;
    sheet.getCell('A1').font = { name: 'Calibri', size: 18, bold: true, color: { argb: 'FFFFFFFF' } };
    sheet.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${technology.accent.slice(1)}` } };
    sheet.getRow(1).height = 36;
    sheet.mergeCells('A2:D2');
    sheet.getCell('A2').value = 'Plantilla base | Roles y tiempos orientativos; validar antes de ejecutar.';
    sheet.getCell('A2').font = { italic: true, color: { argb: 'FF525252' }, size: 11 };
    sheet.getRow(2).height = 24;
    sheet.getRow(4).values = ['Tarea', 'Responsable', 'A quien se solicita', 'Tiempo estimado (min)'];
    sheet.getRow(4).height = 28;
    sheet.getRow(4).eachCell((cell) => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF303030' } };
      cell.alignment = { vertical: 'middle', wrapText: true };
    });
    for (const [index, task] of tasks.entries()) {
      const row = sheet.addRow([task.task, task.owner, task.requestedFrom, task.minutes]);
      row.height = 44;
      row.eachCell((cell) => {
        cell.font = { name: 'Calibri', size: 11, color: { argb: 'FF242424' } };
        cell.alignment = { vertical: 'middle', wrapText: true };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: index % 2 ? 'FFF5F5F5' : 'FFFFFFFF' } };
        cell.border = { bottom: { style: 'hair', color: { argb: 'FFD4D4D4' } } };
      });
      row.getCell(4).numFmt = '0" min"';
    }
    const totalRow = sheet.addRow(['Tiempo total estimado', '', formatDuration(total), { formula: `SUM(D5:D${4 + tasks.length})`, result: total }]);
    totalRow.font = { bold: true };
    totalRow.height = 28;
    totalRow.getCell(4).numFmt = '0" min"';
    sheet.autoFilter = `A4:D${4 + tasks.length}`;
    sheet.pageSetup.printTitlesRow = '1:4';
    sheet.headerFooter.oddFooter = 'DevOps OXXO | &A | Pagina &P de &N';
  }

  return workbook.xlsx.writeBuffer();
}
