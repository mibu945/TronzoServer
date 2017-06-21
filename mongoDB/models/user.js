var mongoose = require('mongoose');

var userSchema = new mongoose.Schema({
    fbID: {type: String},
    name: {type: String, require: true},
    birthday: String,
    gender: String,
    account: {type: String, unique: true},
    password: String,   
    description: String,
    profilePic: String,
    stores: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'BookModel'
    }],
    storedList: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'BookModel'
    }],
    bookHistorys: [{
        book: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'BookModel'
        }, 
        section: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'ArticleModel'
        },
        sectionNum: {
            type: Number
        }
    }],
    follows: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'UserModel'
    }],
    //meta

    lastReadTime: {type: Date},
    readBookCnt: {type: Number, default: 1},
    rank: {type: Number, default: 1}
});

module.exports = mongoose.model('UserModel', userSchema);
