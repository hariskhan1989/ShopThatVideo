'use strict';

var _ = require('lodash');
var Project = require('./project.model');
var Product = require('../product/product.model');

var returnProject = function(req, res) {
  var populateDetails = req.params.populateDetails || req.body.populateDetails;
  if(req.body.populateDetails) { delete req.body.populateDetails; }
  console.log('populateDetails', populateDetails, req.params.id);
  if(populateDetails) {
    Project.findById(req.params.id)
    .populate('productGroupTimeLine')
    .populate('category',{ name: 1 })
    .exec(function(err, project){
      if(err) { return handleError(res, err); }
      if(!project) { return res.status(404).send('Not Found'); }
      console.log('project._id', project._id);
      Project.populate(project, { 
        path: 'productGroupTimeLine.products',
        model: 'Product' 
      }, function(err, updatedProject) {
        // console.log('populated: ', updatedProject.productGroupTimeLine);
        if(err) {
          console.log('error populating products');
          return res.status(500).json({
            err: err,
            message: 'error populating products'
          });
        }
        return res.json(project);
      });
      // return res.json(project);
    });
  } else {
    Project.findById(req.params.id)
    .exec(function(err, project){
      console.log('project', project);
      if(err) { return handleError(res, err); }
      if(!project) { return res.status(404).send('Not Found'); }
      res.json(project);
    });
  }
};
// Get list of projects
exports.index = function(req, res) {
  var activeOnly = req.query.activeOnly == true || req.query.activeOnly == 'true'?true:false;
  var testing = req.query.testing == true || req.query.testing == 'true'?true:false;
  var query = {
    isPrivate: false,
    $or: []
  };
  if(activeOnly) {
    query.$or.push({
      active: true
    });
  }
  if(testing) {
    // if(!query.$or) query = {
    //   $or: []
    // }
    query.$or.push({
      testing: true
    });
  }
  Project.find(query)
  // sorting from newest to oldest
  .sort([['_id', -1]])
  .populate('createdBy',{ name: 1 })
  .populate('category',{ name: 1 })
  .populate({
    path: 'productGroupTimeLine',
    populate: {
        path:  'products',
        model: 'Product'
      }
  })
  .exec(function (err, projects) {
    if(err) { return handleError(res, err); }
    projects.forEach(function(project) {
      // console.log('project.productGroupTimeLine[0]', project.productGroupTimeLine[0]);
      project.stats.videoPauseCount = _.reduce(project.productGroupTimeLine, function(sum, productGroup) {
        // console.log('productGroup.stats', productGroup.stats);
        return sum + (productGroup.stats?productGroup.stats.pauseCount?productGroup.stats.pauseCount:0:0);
      }, 0);
      project.stats.videoClickCount = 0;
      project.stats.productCount = 0;
      _.each(project.productGroupTimeLine, function(productGroup) {
        project.stats.productCount += productGroup.products.length;
        _.each(productGroup.products, function(product){
          // console.log('product', product);
          project.stats.videoClickCount += product.stats.clickCount;
        });
      });
    });
    return res.status(200).json(projects);
  });
};

// Get list of projects for loggedin user
exports.getMyProjects = function(req, res) {
  Project.find({ 'createdBy': req.user._id })
  // sorting from newest to oldest
  .sort([['_id', -1]])
  .populate('category',{ name: 1 })
  .populate({
    path: 'productGroupTimeLine',
    populate: {
        path:  'products',
        model: 'Product'
      }
  })
  .exec(function (err, projects) {
    if(err) { return handleError(res, err); }
    projects.forEach(function(project) {
      // console.log('project.productGroupTimeLine[0]', project.productGroupTimeLine[0]);
      project.stats.videoPauseCount = _.reduce(project.productGroupTimeLine, function(sum, productGroup) {
        // console.log('productGroup.stats', productGroup.stats);
        return sum + (productGroup.stats?productGroup.stats.pauseCount?productGroup.stats.pauseCount:0:0);
      }, 0);
      project.stats.videoClickCount = 0;
      project.productGroupTimeLine.forEach(function(productGroup) {
        productGroup.products.forEach(function(product){
          // console.log('product', product);
          project.stats.videoClickCount += product.stats.clickCount;
        });
      });
      project.stats.buyNowClickCount = 0;
      project.productGroupTimeLine.forEach(function(productGroup) {
        productGroup.products.forEach(function(product){
          // console.log('product', product);
          project.stats.buyNowClickCount += product.stats.clickBuyNowCount;
        });
      });
    });
    return res.status(200).json(projects);
  });
};

// Get a single project
exports.show = function(req, res) {
  returnProject(req, res);
};

// Creates a new project in the DB.
exports.create = function(req, res) {
  req.body.createdBy = req.user._id;
  Project.create(req.body, function(err, project) {
    if(err) { return handleError(res, err); }
    return res.status(201).json(project);
  });
};

// Updates an existing project in the DB.
exports.update = function(req, res) {
  if(req.body._id) { delete req.body._id; }
  if(req.body.__v) { delete req.body.__v; }
  Project.findById(req.params.id)
  .populate('productGroupTimeLine')
  .populate('category',{ name: 1 })
  .exec(function (err, project) {
    if (err) { return handleError(res, err); }
    if(!project) { return res.status(404).send('Not Found'); }
    project.productGroupTimeLine.forEach(function(productGroup) {
      // console.log('productGroup.id', productGroup._id, req.body.productGroupTimeLine[0]);
      // console.log(_.find([{_id: 1}], { _id: 1 }));
      
      var targetProductGroup = _.find(req.body.productGroupTimeLine, { _id: productGroup._id+'' });
      if(targetProductGroup) {
        // console.log('##### targetProductGroup.time', targetProductGroup.time);
        productGroup.time = targetProductGroup.time;
        productGroup.save();
      }
    });
    // var updated = _.merge(project, req.body);
    project.name = req.body.name;
    project.category = req.body.category;
    project.description = req.body.description;
    project.media = req.body.media;
    project.thumbnail = req.body.thumbnail;
    project.active = req.body.active;
    project.isPrivate = req.body.isPrivate;

    // console.log('updated', project);
    project.save(function (err) {
      console.log('update err', err);
      if (err) { return handleError(res, err); }
      returnProject(req, res);
    });
  });
};

var updateStats = function(req, res, updateVar) {
  if(req.body._id) { delete req.body._id; }
  Project.findById(req.params.id, function (err, project) {
    if (err) { return handleError(res, err); }
    if(!project) { return res.status(404).send('Not Found'); }
    
    if(project.stats) {
      project.stats[updateVar] = (project.stats[updateVar] || 0) + 1;
    } else {
      project.stats = {};
      project.stats[updateVar] = 1;
    }
    
    project.save(function (err) {
      if (err) { return handleError(res, err); }
      returnProject(req, res);
    });
  });
};

exports.increaseVideoWatchCount = function(req, res) {
  return updateStats(req, res, 'videoWatchCount');
};

exports.increaseWatchCount = function(req, res) {
  return updateStats(req, res, 'watchCount');
};

exports.increaseVideoPauseCount = function(req, res) {
  return updateStats(req, res, 'videoPauseCount');
};

exports.increaseVideoClickCount = function(req, res) {
  return updateStats(req, res, 'videoClickCount');
};

exports.resetStats = function(req, res) {
  if(req.body._id) { delete req.body._id; }
  Project.findById(req.params.id, function (err, project) {
    if (err) { return handleError(res, err); }
    if(!project) { return res.status(404).send('Not Found'); }
    
    project.stats = {
      watchCount: 0,
      videoClickCount : 0,
      videoWatchCount: 0,
      videoPauseCount: 0
    };
    
    project.save(function (err) {
      if (err) { return handleError(res, err); }
      returnProject(req, res);
    });
  });
};

// Deletes a project from the DB.
exports.destroy = function(req, res) {
//   Project.findById(req.params.id, function (err, project) {
//     if(err) { return handleError(res, err); }
//     if(!project) { return res.status(404).send('Not Found'); }
//     project.remove(function(err) {
//       if(err) { return handleError(res, err); }
//       return res.status(204).send('No Content');
//     });
//   });
};

function handleError(res, err) {
  return res.status(500).send(err);
}