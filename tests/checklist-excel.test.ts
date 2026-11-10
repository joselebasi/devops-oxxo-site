import assert from 'node:assert/strict';
import { test } from 'node:test';
import ExcelJS from 'exceljs';
import { environments, getChecklist, technologies } from '../src/lib/checklists.ts';
import { createChecklistWorkbook } from '../src/lib/server/checklist-excel.ts';

test('exports every technology as a valid XLSX with three complete environment sheets', async () => {
  for (const technology of technologies) {
    const buffer = await createChecklistWorkbook(technology.id);
    assert.equal(Buffer.from(buffer).subarray(0, 2).toString(), 'PK');
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);
    assert.deepEqual(workbook.worksheets.map((sheet) => sheet.name), ['DEV', 'QA', 'PRD']);
    for (const environment of environments) {
      const sheet = workbook.getWorksheet(environment.name)!;
      const tasks = getChecklist(technology.id, environment.id);
      assert.equal(sheet.getCell('A5').value, tasks[0]!.task);
      assert.equal(sheet.getCell('D5').value, tasks[0]!.minutes);
      assert.equal(sheet.getCell('D13').result, tasks.reduce((total, task) => total + task.minutes, 0));
      assert.equal(sheet.autoFilter, 'A4:D12');
      assert.equal(sheet.views[0]!.state, 'frozen');
      assert.equal(sheet.getRow(4).cellCount, 4);
    }
  }
});
