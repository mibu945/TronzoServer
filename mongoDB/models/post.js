var mongoose = require('mongoose');

var postSchema = new mongoose.Schema({
    author: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "UserModel"
    },
    book: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "BookModel"
    },
    content: {
        type: String,
        require: true
    },
    comments: [{
        author: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "UserModel"
        },
        content: {type: String, require: true}
    }],
  
    likeUsers: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "UserModel"
    }],
    shareUsers: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "UserModel"
    }],

    // meta
    point: {type: Number, min: 0, default: 0},
    createTime: {type: Date, default: Date.now},
    updateTime: {type: Date, default: Date.now}
}, {
    timestamps: { createdAt: 'createTime'}
});

module.exports = mongoose.model('PostModel', postSchema);
