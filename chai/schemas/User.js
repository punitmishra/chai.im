'use strict';

var util    = require('util');
var bcrypt  = require('bcrypt');
var mongoose = require('mongoose');
var Schema   = mongoose.Schema;

var validatePresenceOf = function(value){
  return value && value.length; 
};

var toLower = function(string){
  return string.toLowerCase();
};

var getId = function(){
  return new Date().getTime();
};

var User = new Schema({
  'key' : {
    unique : true,
    type : Number,
    default: getId
  },
  'username' : { type : String, 
              validate : [validatePresenceOf, 'a Username is required'],
              set : toLower,
              index : { unique : true }
              },
  'password' : String,
});

User.statics.findUser = function(username, cb){
  return  this.find({'username' : username}, cb);
};

User.statics.validateUser = function(username, password, cb){
  this.find({'username' : username}, function(err, response){
    var user = response[0];
    if(!user || response.length === 0){
      cb(new Error('AuthFailed : Username does not exist'));
    }else{
      if(password == user.password){
        util.log('Authenticated User ' + username);
        cb(null, user);
      }else{
        cb(new Error('AuthFailed : Invalid Password'));
      }
    }
  });
};

module.exports = mongoose.model('User' , User);
