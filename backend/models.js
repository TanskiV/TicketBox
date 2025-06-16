const mongoose = require('mongoose');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/hotel_sharon';

mongoose.connect(MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true });

const DepartmentSchema = new mongoose.Schema({
  name: { type: String, required: true }
});
const Department = mongoose.model('Department', DepartmentSchema);

const UserSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  passwordHash: { type: String, required: true },
  role: { type: String, enum: ['admin', 'user'], default: 'user' },
  departmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Department' }
});
const User = mongoose.model('User', UserSchema);

const TicketSchema = new mongoose.Schema({
  title: String,
  description: String,
  room: String,
  departmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Department' },
  createdBy: String,
  createdAt: { type: Date, default: Date.now },
  closedAt: Date,
  isClosed: { type: Boolean, default: false },
  imageUrl: String
});
const Ticket = mongoose.model('Ticket', TicketSchema);

module.exports = { mongoose, Ticket, User, Department };
