require('dotenv').config();
const mongoose = require('mongoose');

const MONGO_URI = process.env.MONGODB_URI;
if(!MONGO_URI) {
  throw new Error('MONGODB_URI is not defined');
}

mongoose.connect(MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  dbName: 'ticketbox',
});

mongoose.connection.once('open', () => {
  console.log('✅ Connected to MongoDB');
});
mongoose.connection.on('error', console.error);

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
  isClosed: { type: Boolean, default: false }
});
const Ticket = mongoose.model('Ticket', TicketSchema);

const PhotoSchema = new mongoose.Schema({
  ticketId: { type: mongoose.Schema.Types.ObjectId, ref: 'Ticket', required: true },
  data: Buffer,
  contentType: String
});
const Photo = mongoose.model('Photo', PhotoSchema);

module.exports = { mongoose, Ticket, User, Department, Photo };
