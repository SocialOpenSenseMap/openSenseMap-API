'use strict';

const usersController = require('./usersController'),
  boxesController = require('./boxesController'),
  statisticsController = require('./statisticsController'),
  sensorsController = require('./sensorsController'),
  measurementsController = require('./measurementsController'),
  managementController = require('./managementController'),
  notificationController = require('./notificationController');

module.exports = {
  usersController,
  boxesController,
  statisticsController,
  sensorsController,
  measurementsController,
  managementController,
  notificationController
};
