/**
 * src/modules/auth/auth.service.js
 * 
 * Purpose:
 * Business logic layer for authentication, identity management, and credential verification.
 */

const User = require('../users/user.model');
const ApiError = require('../../utils/ApiError');
const { nextSequence } = require('../../utils/counter');
const { logAudit } = require('../audit/audit.service');
const {
  hashPassword,
  comparePassword,
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  hashToken
} = require('../../utils/token');

/**
 * Registers a new citizen user
 */
const register = async (userData) => {
  const existing = await User.findOne({ email: userData.email.toLowerCase() });
  if (existing) {
    throw new ApiError(409, 'Email is already registered');
  }

  const seq = await nextSequence('users', 1001);
  const userCode = `USR-${seq}`;
  const passwordHash = await hashPassword(userData.password);

  const newUser = new User({
    userCode,
    name: userData.name,
    email: userData.email.toLowerCase(),
    passwordHash,
    role: 'citizen', // Force role to citizen
    phone: userData.phone || '',
    ward: userData.ward || '',
    accountStatus: 'Active',
    trustScore: 0,
    memberSince: new Date()
  });

  const savedUser = await newUser.save();

  logAudit({
    action: 'USER_REGISTERED',
    relatedRecord: savedUser.userCode,
    user: `${savedUser.name} (${savedUser.userCode})`,
    role: savedUser.role,
    description: `New citizen registered with email ${savedUser.email}`
  });

  return savedUser;
};

/**
 * Authenticates user credentials and issues JWT token pair
 */
const login = async (email, password) => {
  const normalizedEmail = email.toLowerCase().trim();
  const user = await User.findOne({ email: normalizedEmail }).select('+passwordHash +refreshTokenHash');

  if (!user) {
    logAudit({
      action: 'LOGIN_FAILED',
      relatedRecord: normalizedEmail,
      user: `Anonymous (${normalizedEmail})`,
      role: 'unknown',
      description: 'Login attempt failed: email not found'
    });
    throw new ApiError(401, 'Invalid email or password');
  }

  // Check login lockout (5 failed attempts = 15 minute lock)
  if (user.lockUntil && user.lockUntil > new Date()) {
    const minutesLeft = Math.ceil((user.lockUntil.getTime() - Date.now()) / (60 * 1000));
    throw new ApiError(423, `Account is temporarily locked. Try again in ${minutesLeft} minute(s).`);
  }

  // Check password
  const isMatch = await comparePassword(password, user.passwordHash);
  if (!isMatch) {
    user.failedLoginAttempts = (user.failedLoginAttempts || 0) + 1;
    if (user.failedLoginAttempts >= 5) {
      user.lockUntil = new Date(Date.now() + 15 * 60 * 1000);
    }
    await user.save();

    logAudit({
      action: 'LOGIN_FAILED',
      relatedRecord: user.userCode,
      user: `${user.name} (${user.userCode})`,
      role: user.role,
      description: `Login attempt failed: incorrect password (attempt ${user.failedLoginAttempts})`
    });

    throw new ApiError(401, 'Invalid email or password');
  }

  // Account suspension check
  if (user.accountStatus === 'Suspended') {
    throw new ApiError(403, 'Account suspended');
  }

  // Reset lockout
  user.failedLoginAttempts = 0;
  user.lockUntil = undefined;

  // Sign tokens
  const accessToken = signAccessToken(user);
  const refreshToken = signRefreshToken(user);

  // Store hashed refresh token
  user.refreshTokenHash = hashToken(refreshToken);
  await user.save();

  logAudit({
    action: 'LOGIN_SUCCESS',
    relatedRecord: user.userCode,
    user: `${user.name} (${user.userCode})`,
    role: user.role,
    description: `User logged in successfully`
  });

  return {
    accessToken,
    refreshToken,
    user
  };
};

/**
 * Rotates refresh token and issues a new access token
 */
const refresh = async (refreshToken) => {
  let decoded;
  try {
    decoded = verifyRefreshToken(refreshToken);
  } catch (err) {
    throw new ApiError(401, 'Invalid or expired refresh token');
  }

  const user = await User.findOne({ userCode: decoded.sub }).select('+refreshTokenHash');
  if (!user) {
    throw new ApiError(401, 'User not found or session expired');
  }

  if (user.accountStatus === 'Suspended') {
    throw new ApiError(403, 'Account suspended');
  }

  const incomingHash = hashToken(refreshToken);

  // Reuse / token theft detection (Part 5)
  if (!user.refreshTokenHash || user.refreshTokenHash !== incomingHash) {
    user.refreshTokenHash = undefined;
    await user.save();
    throw new ApiError(401, 'Invalid or reused refresh token. Please log in again.');
  }

  // Rotate token
  const newAccessToken = signAccessToken(user);
  const newRefreshToken = signRefreshToken(user);

  user.refreshTokenHash = hashToken(newRefreshToken);
  await user.save();

  return {
    accessToken: newAccessToken,
    refreshToken: newRefreshToken,
    user
  };
};

/**
 * Invalidates user refresh token session
 */
const logout = async (user) => {
  if (user) {
    await User.findByIdAndUpdate(user._id, { $unset: { refreshTokenHash: 1 } });
  }
};

/**
 * Updates user password
 */
const changePassword = async (user, currentPassword, newPassword) => {
  const fullUser = await User.findById(user._id).select('+passwordHash');
  if (!fullUser) {
    throw new ApiError(404, 'User not found');
  }

  const isMatch = await comparePassword(currentPassword, fullUser.passwordHash);
  if (!isMatch) {
    throw new ApiError(400, 'Current password is incorrect');
  }

  fullUser.passwordHash = await hashPassword(newPassword);
  fullUser.refreshTokenHash = undefined; // Force re-login on all devices
  await fullUser.save();

  logAudit({
    action: 'PASSWORD_CHANGED',
    relatedRecord: fullUser.userCode,
    user: `${fullUser.name} (${fullUser.userCode})`,
    role: fullUser.role,
    description: 'User changed account password'
  });
};

module.exports = {
  register,
  login,
  refresh,
  logout,
  changePassword
};
