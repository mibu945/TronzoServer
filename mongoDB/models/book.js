var mongoose = require('mongoose');

var bookSchema = new mongoose.Schema({
    //owner data  
    userID: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "UserModel"
    },
    title: {type: String, require: true},
    cover: {type: Buffer},
    type: {type: String, require: true},
    description: {type: String, require: true},
    contents: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "ArticleModel"
    }],

    //other data
    likeUsers: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "UserModel"
    }],
    comments: [{
        userID: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "UserModel"
        },
        content: {type: String, require: true}
    }],
    browserNum: {type: Number, min: 0, default: 0},
    // meta
    createTime: {type: Date, default: Date.now},
    updateTime: {type: Date, default: Date.now},
}, {
    timestamps: { createdAt: 'createTime', updatedAt: 'updateTime' }
});

module.exports = mongoose.model('BookModel', bookSchema);
