var mongoose = require('mongoose');

var bookSchema = new mongoose.Schema({
    //owner data  
    author: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "UserModel"
    },
    title: {type: String, require: true},
    cover: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "ImageModel"
    },

    bookType: {type: String, require: true},
    description: {type: String, require: true},
    sections: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "ArticleModel"
    }],

    //other data
    likeUsers: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "UserModel"
    }],
    storeUsers: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "UserModel"
    }],
    comments: [{
        author: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "UserModel"
        },
        content: {type: String, require: true}
    }],
    readCnt: {type: Number, min: 0, default: 0},
    // meta
    createTime: {type: Date, default: Date.now},
    updateTime: {type: Date, default: Date.now},
}, {
    timestamps: { createdAt: 'createTime', updatedAt: 'updateTime' }
});

module.exports = mongoose.model('BookModel', bookSchema);
