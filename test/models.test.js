const { Ticket, User, Department } = require('../backend/models');

test('Ticket isClosed defaults to false', () => {
  const def = Ticket.schema.path('isClosed').defaultValue;
  expect(def).toBe(false);
});

test('User role enum and default', () => {
  const rolePath = User.schema.path('role');
  expect(rolePath.enumValues).toEqual(['admin', 'superuser', 'user']);
  expect(rolePath.defaultValue).toBe('user');
});

test('Department name is required', () => {
  const namePath = Department.schema.path('name');
  expect(namePath.isRequired).toBe(true);
});

test('Ticket has numeric ticketNumber', () => {
  const numPath = Ticket.schema.path('ticketNumber');
  expect(numPath.instance).toBe('Number');
});
