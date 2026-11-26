/**
 * src/scripts/createAdmin.js
 * 
 * Purpose:
 * CLI administrative script to bootstrap a system administrator account.
 * Usage:
 *   npm run create-admin -- --email admin@civicreflex.gov.in --name "System Admin" --password "SecureAdmin123!"
 * 
 * Never prints password to stdout/stderr.
 */

const mongoose = require('mongoose');
const connectDB = require('../config/db');
const User = require('../modules/users/user.model');
const { nextSequence } = require('../utils/counter');
const { hashPassword } = require('../utils/token');

// Parse CLI flags
const parseArgs = () => {
  const args = process.argv.slice(2);
  const options = {};

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--email' && args[i + 1]) {
      options.email = args[++i].trim();
    } else if (args[i] === '--name' && args[i + 1]) {
      options.name = args[++i].trim();
    } else if (args[i] === '--password' && args[i + 1]) {
      options.password = args[++i];
    }
  }

  return options;
};

const run = async () => {
  const { email, name, password } = parseArgs();

  if (!email || !name || !password) {
    console.error('Error: Missing required arguments. Please supply --email, --name, and --password.');
    console.error('Usage: npm run create-admin -- --email <email> --name "<name>" --password "<password>"');
    process.exit(1);
  }

  if (password.length < 8) {
    console.error('Error: Password must be at least 8 characters long.');
    process.exit(1);
  }

  try {
    await connectDB();

    const normalizedEmail = email.toLowerCase();
    const existing = await User.findOne({ email: normalizedEmail });

    if (existing) {
      if (existing.role === 'admin') {
        console.log(`[create-admin] User ${normalizedEmail} is already an admin (${existing.userCode}).`);
        await mongoose.disconnect();
        process.exit(0);
      }
      existing.role = 'admin';
      existing.passwordHash = await hashPassword(password);
      await existing.save();
      console.log(`[create-admin] Existing user ${normalizedEmail} upgraded to admin role (${existing.userCode}).`);
      await mongoose.disconnect();
      process.exit(0);
    }

    const seq = await nextSequence('users', 1001);
    const userCode = `USR-${seq}`;
    const passwordHash = await hashPassword(password);

    const adminUser = new User({
      userCode,
      name,
      email: normalizedEmail,
      passwordHash,
      role: 'admin',
      accountStatus: 'Active',
      memberSince: new Date()
    });

    await adminUser.save();
    console.log(`[create-admin] Admin account successfully created. UserCode: ${userCode}, Email: ${normalizedEmail}`);

    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('[create-admin] Failed to create admin user:', err.message);
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    process.exit(1);
  }
};

run();
