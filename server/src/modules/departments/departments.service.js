/**
 * src/modules/departments/departments.service.js
 * 
 * Purpose:
 * Business logic layer for Municipal Departments.
 * Handles fetching, code-based lookups, and creation with duplicate code prevention.
 */

const Department = require('./department.model');
const ApiError = require('../../utils/ApiError');

/**
 * Retrieves all departments sorted alphabetically by name
 * @returns {Promise<Array>}
 */
const getAllDepartments = async () => {
  return Department.find().sort({ name: 1 });
};

/**
 * Retrieves a single department by its unique code (e.g. "PWD-ROADS")
 * @param {string} code
 * @returns {Promise<Object>}
 */
const getDepartmentByCode = async (code) => {
  const department = await Department.findOne({ code: code.toUpperCase() });
  if (!department) {
    throw new ApiError(404, `Department with code '${code}' not found`);
  }
  return department;
};

/**
 * Creates a new department
 * @param {Object} departmentData
 * @returns {Promise<Object>}
 */
const createDepartment = async (departmentData) => {
  // Check if department code already exists
  const existing = await Department.findOne({ code: departmentData.code.toUpperCase() });
  if (existing) {
    throw new ApiError(409, `Department with code '${departmentData.code}' already exists`);
  }

  const department = new Department({
    ...departmentData,
    code: departmentData.code.toUpperCase()
  });

  return department.save();
};

module.exports = {
  getAllDepartments,
  getDepartmentByCode,
  createDepartment
};

