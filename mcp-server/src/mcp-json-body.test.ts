import test from 'node:test';
import assert from 'node:assert';
import {
  jsonBodyFromToolArgs,
  resolveProjectId,
} from './mcp-json-body.js';

test('resolveProjectId prefers projectId then project_id', () => {
  assert.equal(resolveProjectId({ projectId: ' a ', project_id: 'b' }), 'a');
  assert.equal(resolveProjectId({ project_id: ' b ' }), 'b');
  assert.equal(resolveProjectId({}), '');
});

test('strips actorUserId from write bodies', () => {
  const body = jsonBodyFromToolArgs({
    name: 'Julia',
    project_id: 'proj-1',
    actorUserId: 'user-secret',
  });
  assert.equal(body.actorUserId, undefined);
  assert.equal(body.projectId, 'proj-1');
  assert.equal(body.project_id, 'proj-1');
  assert.equal(body.name, 'Julia');
});

test('projectIdMode projectId drops snake_case', () => {
  const body = jsonBodyFromToolArgs(
    { project_id: 'proj-1', name: 'X', actorUserId: 'u' },
    { projectIdMode: 'projectId', mapSegmentToRole: true }
  );
  assert.equal(body.projectId, 'proj-1');
  assert.equal(body.project_id, undefined);
  assert.equal(body.actorUserId, undefined);
});

test('mapSegmentToRole fills role from segment', () => {
  const body = jsonBodyFromToolArgs(
    { segment: 'Buyer', name: 'X' },
    { mapSegmentToRole: true, projectIdMode: 'none' }
  );
  assert.equal(body.role, 'Buyer');
});

test('omit drops path params', () => {
  const body = jsonBodyFromToolArgs(
    { persona_id: 'p1', name: 'N', actorUserId: 'u' },
    { omit: ['persona_id'], projectIdMode: 'none' }
  );
  assert.equal(body.persona_id, undefined);
  assert.equal(body.name, 'N');
});
