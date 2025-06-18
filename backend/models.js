const mongoose = require('mongoose');

const DepartmentSchema = new mongoose.Schema({
  name: { type: String, required: true }
});
const Department = mongoose.model('Department', DepartmentSchema);

const UserSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  passwordHash: { type: String, required: true },
  name: String,
  email: String,
  role: { type: String, enum: ['admin', 'superuser', 'user'], default: 'user' },
  departmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Department' }
});
const User = mongoose.model('User', UserSchema);

const TicketSchema = new mongoose.Schema({
  ticketNumber: { type: Number, unique: true },
  title: String,
  description: String,
  room: String,
  departmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Department' },
  openedBy: { type: String, default: 'guest' },
  openedAt: { type: Date, default: Date.now },
  closedBy: String,
  closedAt: Date,
  isClosed: { type: Boolean, default: false }
});
const Ticket = mongoose.model('Ticket', TicketSchema);

const PhotoSchema = new mongoose.Schema({
  ticketId: { type: mongoose.Schema.Types.ObjectId, ref: 'Ticket', required: true },
  data: Buffer,
  contentType: String
});
const Photo = mongoose.model('Photo', PhotoSchema);

const NewsSchema = new mongoose.Schema({
  title: { type: String, required: true },
  content: { type: String, required: true },
  imageUrl: String,
  createdAt: { type: Date, default: Date.now }
});
const News = mongoose.model('News', NewsSchema);

// Include virtual `id` field when converting documents to JSON or plain objects
[DepartmentSchema, UserSchema, TicketSchema, PhotoSchema].forEach(schema => {
  schema.set('toJSON', { virtuals: true });
  schema.set('toObject', { virtuals: true });
});

module.exports = { mongoose, Ticket, User, Department, Photo, News };
