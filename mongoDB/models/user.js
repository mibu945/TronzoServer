var mongoose = require('mongoose');

var userSchema = new mongoose.Schema({
    //user uploading data
    ID: String,
    account: { type: String, unique: true, require: true},
    password: { type: String, require: true},   
    email: String,
    description: String,
    photo: Buffer,
    collections: [{
        type: mongoose.Schema.Types.ObjectId,
        unique: true,
        ref: 'BookModel'
    }],
    follows: [{
        type: mongoose.Schema.Types.ObjectId,
        unique: true,
        ref: 'UserModel'
    }],
    //system's data 
    rank: {type: Number, default: 1}
});

module.exports = mongoose.model('UserModel', userSchema);
