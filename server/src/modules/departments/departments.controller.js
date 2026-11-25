/**
 * src/modules/departments/departments.controller.js
 * 
 * Purpose:
 * Controller layer for handling HTTP requests and formatting responses for Departments.
 */

const departmentsService = require('./departments.service');

/**
 * GET /api/departments
 * Retrieves all departments sorted by name.
 */
const getDepartments = async (req, res, next) => {
  try {
    const departments = await departmentsService.getAllDepartments();

    res.status(200).json({
      success: true,
      data: departments
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/departments/:code
 * Retrieves a single department by its unique uppercase code.
 */
const getDepartmentByCode = async (req, res, next) => {
  try {
    const department = await departmentsService.getDepartmentByCode(req.params.code);

    res.status(200).json({
      success: true,
      data: department
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/departments
 * Creates a new department.
 */
const createDepartment = async (req, res, next) => {
  try {
    const department = await departmentsService.createDepartment(req.body);

    res.status(201).json({
      success: true,
      data: department
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getDepartments,
  getDepartmentByCode,
  createDepartment
};

