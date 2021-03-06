var mongoose = require('mongoose');

var articleSchema = new mongoose.Schema({

    title: {type: String},
    content: {type: String},
    wordCnt: {type: Number, default: 0},
    comments: [{
        author: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "UserModel"
        },
        pageNum : {type: Number},
        content: {type: String, require: true}
    }],   
// meta
    createTime: {type: Date, default: Date.now},
    updateTime: {type: Date, default: Date.now},
}, {
    timestamps: { createdAt: 'createTime', updatedAt: 'updateTime' }
});

module.exports = mongoose.model('ArticleModel', articleSchema);
