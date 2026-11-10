import assert from 'node:assert/strict';
import { test } from 'node:test';
import { environments, formatDuration, getChecklist, getEnvironment, getTechnology, technologies } from '../src/lib/checklists.ts';

test('every technology has complete static activities for DEV, QA and PRD', () => {
  for (const technology of technologies) {
    for (const environment of environments) {
      const tasks = getChecklist(technology.id, environment.id);
      assert.equal(tasks.length, 8);
      for (const task of tasks) {
        assert.ok(task.task && task.owner && task.requestedFrom);
        assert.ok(Number.isInteger(task.minutes) && task.minutes > 0);
      }
      assert.match(tasks[0]!.task, new RegExp(environment.name));
    }
  }
});

test('query parameters accept only known technologies and environments', () => {
  assert.equal(getTechnology('terraform')?.name, 'Terraform');
  assert.equal(getTechnology('constructor'), undefined);
  assert.equal(getTechnology(null), undefined);
  assert.equal(getEnvironment('qa').id, 'qa');
  assert.equal(getEnvironment('invalid').id, 'dev');
});

test('formats estimated time without losing minutes', () => {
  assert.equal(formatDuration(45), '45 min');
  assert.equal(formatDuration(60), '1 h');
  assert.equal(formatDuration(95), '1 h 35 min');
});
