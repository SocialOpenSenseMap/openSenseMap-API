'use strict';

const
  { checkContentType } = require('../helpers/apiUtils'),
  {
    retrieveParameters,
  } = require('../helpers/userParamHelpers'),
  handleError = require('../helpers/errorHandler'),
  { model: NotificationRule } = require('../../../models/src/notification/notificationRule'),
  { model: NotificationRuleConnector } = require('../../../models/src/notification/notificationRuleConnector'),
  { model: Notification } = require('../../../models/src/notification/notification'),
  { schema: NotificationChannelSchema } = require('../../../models/src/notification/notificationChannel'),
  { model: Box } = require('../../../models/src/box/box'),
  jsonstringify = require('stringify-stream'),
  { UnauthorizedError, NotFoundError } = require('restify-errors');

const connectRules = async function connectRules(req, res, next) {

  try {
    let ruleA = await NotificationRule.find({ _id: req._userParams.ruleA }).exec();
    let ruleB = await NotificationRule.find({ _id: req._userParams.ruleB }).exec();
    if (ruleA.length == 1 && ruleB.length == 1) {
      if (ruleA[0].user == req.user.id && ruleB[0].user == req.user.id) {
        var newConnector= await NotificationRuleConnector.initNew(req.user, req._userParams);
        ruleA[0].connected.push(newConnector._id);
        ruleB[0].connected.push(newConnector._id);
        await NotificationRule.findOneAndUpdate({ _id: ruleA[0]._id }, {"connected": ruleA[0].connected}, { runValidators: true, new: true, context: 'query', upsert: true, setDefaultsOnInsert: true }).exec();
        await NotificationRule.findOneAndUpdate({ _id: ruleB[0]._id }, {"connected": ruleB[0].connected}, { runValidators: true, new: true, context: 'query', upsert: true, setDefaultsOnInsert: true }).exec();
        res.send(201, { message: 'Rules successfully connected', data: newConnector });
      }
      else {
        throw new NotFoundError(`You can onnly connect rules that belong to your user`);
      }
    }
    else {
      throw new NotFoundError(`Rules were not found`);
    }
  } catch (err) {
    handleError(err, next);
  }
}

const deleteConnector = async function deleteConnector(req, res, next) {

  try {

    let connector = await NotificationRuleConnector.find({ _id: req._userParams.notificationRuleConnectorId }).exec();
    if(connector.length == 1) {
      let ruleA = await NotificationRule.find({ _id: connector[0].ruleA }).exec();
      let ruleB = await NotificationRule.find({ _id: connector[0].ruleB }).exec();
      ruleA[0].connected = ruleA[0].connected.filter(x => {
        return x.toString() != connector[0]._id.toString();
      });
      ruleB[0].connected = ruleB[0].connected.filter(x => {
        return x.toString() != connector[0]._id.toString();
      });
      await NotificationRule.findOneAndUpdate({ _id: connector[0].ruleA }, {"connected": ruleA[0].connected}, { runValidators: true, new: true, context: 'query', upsert: true, setDefaultsOnInsert: true }).exec();
      await NotificationRule.findOneAndUpdate({ _id: connector[0].ruleB }, {"connected": ruleB[0].connected}, { runValidators: true, new: true, context: 'query', upsert: true, setDefaultsOnInsert: true }).exec();
    }
        
    await NotificationRuleConnector.remove({ _id: req._userParams.notificationRuleConnectorId }).exec();

    res.send({code: 'Ok', msg: 'Connector deleted'})
  } catch (err) {
    handleError(err, next);
  }
}

const updateConnector = async function updateConnector(req, res, next) {
  
  try {
    // update the old notification rules
    let connector = await NotificationRuleConnector.find({ _id: req._userParams.notificationRuleConnectorId }).exec();
    if(connector.length == 1) {
      let ruleA = await NotificationRule.find({ _id: req._userParams.ruleA }).exec();
      let ruleB = await NotificationRule.find({ _id: req._userParams.ruleB }).exec();
      ruleA[0].connected = ruleA[0].connected.filter(x => {
        return x.toString() != connector[0]._id.toString();
      });
      ruleB[0].connected = ruleB[0].connected.filter(x => {
        return x.toString() != connector[0]._id.toString();
      });
      await NotificationRule.findOneAndUpdate({ _id: connector[0].ruleA }, {"connected": ruleA[0].connected}, { runValidators: true, new: true, context: 'query', upsert: true, setDefaultsOnInsert: true }).exec();
      await NotificationRule.findOneAndUpdate({ _id: connector[0].ruleB }, {"connected": ruleB[0].connected}, { runValidators: true, new: true, context: 'query', upsert: true, setDefaultsOnInsert: true }).exec();
    }
    // update the new notification rules and connector
    let ruleA = await NotificationRule.find({ _id: req._userParams.ruleA }).exec();
    let ruleB = await NotificationRule.find({ _id: req._userParams.ruleB }).exec();
    if (ruleA.length == 1 && ruleB.length == 1) {
      if (ruleA[0].user == req.user.id && ruleB[0].user == req.user.id) {
        var newConnector= await NotificationRuleConnector.findOneAndUpdate({ _id: req._userParams.notificationRuleConnectorId }, req._userParams, { runValidators: true, new: true, context: 'query', upsert: true, setDefaultsOnInsert: true }).exec();
        ruleA[0].connected.push(newConnector._id);
        ruleB[0].connected.push(newConnector._id);
        await NotificationRule.findOneAndUpdate({ _id: ruleA[0]._id }, {"connected": newConnector._id}, { runValidators: true, new: true, context: 'query', upsert: true, setDefaultsOnInsert: true }).exec();
        await NotificationRule.findOneAndUpdate({ _id: ruleB[0]._id }, {"connected": newConnector._id}, { runValidators: true, new: true, context: 'query', upsert: true, setDefaultsOnInsert: true }).exec();
        res.send({ code: 'Ok', data: newConnector });
      }
      else {
        throw new NotFoundError(`You can onnly connect rules that belong to your user`);
      }
    }
    else {
      throw new NotFoundError(`Rules were not found`);
    }
  } catch (err) {
    handleError(err, next);
  }
}

const listNotificationRuleConnectors = async function listNotificationRuleConnectors(req, res, next) {

  try {
    let personalRuleConnectors = await NotificationRuleConnector.find({ user: req.user }).exec();
    let populatedConnectors = [];
    for (let connector in personalRuleConnectors) {
      connector = personalRuleConnectors[connector];
      let notifications = await Notification.find({ notificationRule: connector._id }).sort({'notificationTime': -1}).limit(10).lean().exec();
      let popConnector = { ...connector.toJSON(), notifications: notifications };
      populatedConnectors.push(popConnector);
    };
    res.send(201, { message: 'Connectors successfully retrieved', data: populatedConnectors });
  } catch (err) {
    handleError(err, next);
  }
}

const listNotificationRules = async function listNotificationRules(req, res, next) {

  try {
    let personalRules = await NotificationRule.find({ user: req.user }).exec();
    let populatedRules = [];
    for (let rule in personalRules) {
      rule = personalRules[rule];
      let notifications = await Notification.find({ notificationRule: rule._id }).sort({'notificationTime': -1}).limit(10).lean().exec();
      let popRule = { ...rule.toJSON(), notifications: notifications };
      populatedRules.push(popRule);
    };
    res.send(201, { message: 'Rules successfully retrieved', data: populatedRules });
  } catch (err) {
    handleError(err, next);
  }
}


const createRule = async function createRule(req, res, next) {
  try {
    const box = await Box.findBoxById(req._userParams.box, { populate: false, lean: false });
    if (box.useAuth && box.access_token && box.access_token !== req.headers.authorization) {
      throw new UnauthorizedError('Box access token not valid!');
    }
    req._userParams.sensors.forEach((id) => {
      if(box.sensors.filter((sensor) => { return sensor._id.toString() === id; }).length < 1) {
        throw new NotFoundError(`Sensor not found on box.`);
      }
    })
    var newRule = await NotificationRule.initNew(req.user, req._userParams);
    res.send(201, { message: 'Rule successfully created', data: newRule });
  } catch (err) {
    handleError(err, next);
  }
}

const getRule = async function getRule(req, res, next) {
  try {
    let rule = await NotificationRule.findById(req._userParams.notificationRuleId).exec();
    res.send(201, { message: 'Rule successfully retrieved', data: rule });

  } catch (err) {
    handleError(err, next);
  }
  
  
}

const updateRule = async function updateRule(req, res, next) {
  
  try {
      
    let notificationRule = await NotificationRule.findOneAndUpdate({ _id: req._userParams.notificationRuleId }, req._userParams, { runValidators: true, new: true, context: 'query', upsert: true, setDefaultsOnInsert: true }).exec();
    res.send({ code: 'Ok', data: notificationRule });

  } catch (err) {
    handleError(err, next);
  }
}

const deleteRule = async function deleteRule(req, res, next) {

  try {


    let deletedNotificationRules = await NotificationRule.remove({ _id: req._userParams.notificationRuleId }).exec();
    let connectors = await NotificationRuleConnector.find({ $or: [ { ruleA: req._userParams.notificationRuleId },  
      { ruleB: req._userParams.notificationRuleId }]}).exec();
    connectors.forEach(async (connector) => {
      let ruleId = (connector.ruleA != req._userParams.notificationRuleId) ? connector.ruleA : connector.ruleB
      let rule = await NotificationRule.find({ _id: ruleId }).exec();
      let index = rule[0].connected.indexOf(connector._id.toString());
      if (index > -1) {
        rule[0].connected.splice(index, 1); // 2nd parameter means remove one item only
      }
      await NotificationRule.findOneAndUpdate({ _id: ruleId }, {"connected": rule[0].connected}, { runValidators: true, new: true, context: 'query', upsert: true, setDefaultsOnInsert: true }).exec();
    })
    
    let deletedConnectors = await NotificationRuleConnector.remove({ $or: [ { ruleA: req._userParams.notificationRuleId },  
      { ruleB: req._userParams.notificationRuleId }]}).exec();

    let deletedNotifications = await Notification.remove({ notificationRule: req._userParams.notificationRuleId }).exec();
    
    res.send({code: 'Ok', msg: 'Rule deleted with ' + deletedNotifications.result.n + ' notifications and ' + deletedConnectors.result.n + ' notification rule connectors'})
  } catch (err) {
    handleError(err, next);
  }

}

const getNotifications = async function getNotifications(req, res, next) {

  try {
    let notifications = await Notification.find({ notificationRule: req._userParams.notificationRuleId }).exec();

    res.send(201, { message: 'Notifications successfully retrieved', data: notifications });
  } catch (err) {
    handleError(err, next);
  }
}



module.exports = {
  connectRules: [
    checkContentType,
    retrieveParameters([
      { name: 'name', required: true },
      { name: 'ruleA', required: true },
      { name: 'ruleB', required: true },
      { name: 'connectionOperator', required: true },
      { name: 'active', required: true },
      { name: 'connected', required: false }
    ]),
    connectRules
  ],
  deleteConnector: [
    retrieveParameters([
      { name: 'notificationRuleConnectorId', required: true }
    ]),
    deleteConnector
  ],
  updateConnector: [
    checkContentType,
    retrieveParameters([
      { name: 'notificationRuleConnectorId', required: true },
      { name: 'name', required: true },
      { name: 'ruleA', required: true },
      { name: 'ruleB', required: true },
      { name: 'connectionOperator', required: true },
      { name: 'active', required: true },
      { name: 'connected', required: false }
    ]),
    updateConnector
  ],
  getConnectors: [
    listNotificationRuleConnectors
  ],
  listNotificationRules: [
    listNotificationRules
  ],
  createRule: [
    checkContentType,
    retrieveParameters([
      { predef: 'sensors', required: true },
      { name: 'box', required: true },
      { name: 'name', required: true },
      { name: 'activationThreshold', required: true },
      { name: 'activationOperator', required: true },
      { name: 'activationTrigger', required: true },
      { name: 'notificationChannel', required: true, dataType: [NotificationChannelSchema] },
      { name: 'active', required: true },
      { name: 'connected', required: false }
    ]),
    createRule
  ],
  getRule: [
    retrieveParameters([
      { name: 'notificationRuleId', required: true },
      { name: 'box', required: true }
    ]),
    getRule
  ],
  updateRule: [
    checkContentType,
    retrieveParameters([
      { predef: 'sensors', required: true },
      { name: 'box', required: true },
      { name: 'name', required: true },
      { name: 'notificationRuleId', required: true },
      { name: 'activationThreshold', required: true },
      { name: 'activationOperator', required: true },
      { name: 'activationTrigger', required: true },
      { name: 'notificationChannel', required: true, dataType: [NotificationChannelSchema] },
      { name: 'active', required: true },
      { name: 'connected', required: false }
    ]),
    updateRule
  ],
  deleteRule: [
    retrieveParameters([
      { name: 'notificationRuleId', required: true }
    ]),
    deleteRule
  ],
  getNotifications: [
    retrieveParameters([
      { name: 'notificationRuleId', required: true }
    ]),
    getNotifications
  ]

}
